import { NextRequest } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Authorization guard: expect a Firebase ID token in Authorization: Bearer <token>
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!admin.apps.length) admin.initializeApp();
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized: missing Authorization header' }, { status: 401 });
    }
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const isAdminClaim = !!decoded.admin;
      const adminEmail = String(process.env.TRACEABILITY_ADMIN_EMAIL || '').toLowerCase();
      const emailMatches = adminEmail ? ((decoded.email || '').toLowerCase() === adminEmail) : false;
      if (!isAdminClaim && !emailMatches) {
        return NextResponse.json({ error: 'Forbidden: insufficient privileges' }, { status: 403 });
      }
    } catch (tokenErr) {
      console.warn('Failed verifying ID token for traceability download', tokenErr);
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 });
    }

    const url = new URL(req.url);
    const storagePath = url.searchParams.get('storagePath');
    const invocationId = url.searchParams.get('invocationId');
    const testCaseId = url.searchParams.get('testCaseId');
    const filenameOverride = url.searchParams.get('filename');

    const db = admin.firestore();

    let bucketName = process.env.TRACEABILITY_BUCKET || `${admin.app().options?.projectId || process.env.GCLOUD_PROJECT}.appspot.com`;
    let filePath: string | null = null;

    if (storagePath) {
      let s = storagePath;
      if (s.startsWith('gs://')) {
        s = s.replace(/^gs:\/\//, '');
        const idx = s.indexOf('/');
        if (idx === -1) return new Response(JSON.stringify({ error: 'Invalid storagePath' }), { status: 400, headers: { 'content-type': 'application/json' } });
        bucketName = s.slice(0, idx);
        filePath = s.slice(idx + 1);
      } else {
        filePath = s.replace(/^\//, '');
      }
    } else if (invocationId) {
      const invSnap = await db.collection('evidencePackInvocations').doc(invocationId).get();
      if (!invSnap.exists) return new Response(JSON.stringify({ error: 'invocation not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      const inv = invSnap.data() as any;

      if (testCaseId) {
        const auditSnap = await db.collection(`evidencePackInvocations/${invocationId}/testCaseAudit`).doc(testCaseId).get();
        if (auditSnap.exists) {
          const a = auditSnap.data() as any;
          if (a.pdfStoragePath) filePath = a.pdfStoragePath.replace(/^gs:\/\/[^^/]+\//, '');
          else if (a.storagePath) filePath = a.storagePath.replace(/^gs:\/\/[^^/]+\//, '');
        }
      }

      if (!filePath) {
        if (inv?.pdfStoragePath) filePath = inv.pdfStoragePath.replace(/^gs:\/\/[^^/]+\//, '');
        else if (inv?.manifestStoragePath) filePath = inv.manifestStoragePath.replace(/^gs:\/\/[^^/]+\//, '');
        else if (inv?.mdStoragePath) filePath = inv.mdStoragePath.replace(/^gs:\/\/[^^/]+\//, '');
        else {
          // attempt to list files under the invocation prefix and pick a sensible file
          const bucket = admin.storage().bucket(bucketName);
          try {
            const prefix = `evidence-packs/${invocationId}/`;
            const [files] = await bucket.getFiles({ prefix, maxResults: 50 });
            const manifestFile = files.find((f: any) => /manifest/i.test(f.name));
            const mdFile = files.find((f: any) => /\.md$/i.test(f.name));
            const jsonFile = files.find((f: any) => /\.json$/i.test(f.name));
            const chosen = manifestFile || mdFile || jsonFile || files[0];
            if (chosen) filePath = chosen.name;
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (!filePath) return new Response(JSON.stringify({ error: 'Could not determine file to download' }), { status: 404, headers: { 'content-type': 'application/json' } });

    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return new Response(JSON.stringify({ error: 'file not found' }), { status: 404, headers: { 'content-type': 'application/json' } });

    const [meta] = await file.getMetadata();
    const contentType = (meta && meta.contentType) || 'application/octet-stream';
    const baseName = filenameOverride || path.basename(filePath) || 'download.bin';

    const readStream = file.createReadStream();

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${baseName}"`);
    headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

    return new Response(readStream as any, { status: 200, headers });
  } catch (err: any) {
    console.error('download proxy error', err);
    return new Response(JSON.stringify({ error: String(err && (err.message || err)) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
