import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import traceabilityHelper from '@/lib/traceability';

// Environment guards
const ENABLE_PDF_ON_DEMAND = String(process.env.GENERATE_PDF_ON_DEMAND || '').toLowerCase() === 'true' || String(process.env.GENERATE_PDF_ON_DEMAND || '') === '1';
const PDF_RENDER_TIMEOUT_MS = Number(process.env.PDF_RENDER_TIMEOUT_MS || 20000);

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storagePath, invocationId, testCaseId, type } = body || {};

    if (!storagePath && !invocationId && !(invocationId && testCaseId)) {
      return NextResponse.json({ error: 'Provide storagePath or invocationId (and optional type) or invocationId+testCaseId' }, { status: 400 });
    }

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    let finalStoragePath = storagePath;
    const bucketName = process.env.TRACEABILITY_BUCKET || `${admin.app().options?.projectId || process.env.GCLOUD_PROJECT}.appspot.com`;

    if (!finalStoragePath && invocationId) {
      // fetch invocation doc to find stored paths
      const invSnap = await db.collection('evidencePackInvocations').doc(invocationId).get();
      if (!invSnap.exists) return NextResponse.json({ error: 'invocation not found' }, { status: 404 });
      const inv = invSnap.data() as any;
      if (type === 'pdf' && inv?.pdfStoragePath) finalStoragePath = inv.pdfStoragePath;
      else if ((type === 'md' || type === 'manifest') && inv?.manifestStoragePath) finalStoragePath = inv.manifestStoragePath;
      else if (inv?.mdStoragePath && !inv?.manifestStoragePath) finalStoragePath = inv.mdStoragePath;
      else if (inv?.manifestStoragePath) finalStoragePath = inv.manifestStoragePath;
    }

    if (!finalStoragePath && invocationId && testCaseId) {
      finalStoragePath = traceabilityHelper.storagePathForTestCase(invocationId, testCaseId);
    }

    // If still no finalStoragePath, we will attempt a fallback below (after bucket is available)

    if (!finalStoragePath) return NextResponse.json({ error: 'Could not determine storagePath' }, { status: 400 });

    // normalize storage path
    const path = finalStoragePath.replace(/^gs:\/\//, '').replace(/^\//, '');
    // If the stored path includes the bucket prefix, remove it
    const bucketPrefix = (bucketName || '').replace(/^gs:\/\//, '');
    let filePath = path;
    if (bucketPrefix && path.startsWith(bucketPrefix + '/')) filePath = path.slice(bucketPrefix.length + 1);

    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);
    // If we still don't have a finalStoragePath set earlier, attempt to list files under the invocation prefix
    if (!finalStoragePath && invocationId) {
      try {
        const prefix = `evidence-packs/${invocationId}/`;
        const [files] = await bucket.getFiles({ prefix, maxResults: 50 });
        // prefer manifest or md
        const manifestFile = files.find(f => /manifest/i.test(f.name));
        const mdFile = files.find(f => /\.md$/i.test(f.name));
        const jsonFile = files.find(f => /\.json$/i.test(f.name));
        const chosen = manifestFile || mdFile || jsonFile || files[0];
        if (chosen) {
          // overwrite filePath and file with discovered file
          filePath = chosen.name;
        }
      } catch (listErr) {
        // ignore
      }
    }
    const expiresSeconds = Number(process.env.TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS || 3600);
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000);
    // If a PDF was explicitly requested and on-demand generation is enabled, try to generate one
    if (type === 'pdf' && ENABLE_PDF_ON_DEMAND) {
      // If the invocation already had a pdfStoragePath above we would have used it.
      // If we reach here, no explicit pdfStoragePath was found; attempt to render the source into a PDF.
      try {
        // Lazy import puppeteer only when needed to avoid adding it to cold paths
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const puppeteer = require('puppeteer');

        // Fetch the source (prefer manifest -> md -> signedUrl)
        let sourceText: string | null = null;
        // Try to fetch object contents from storage first (fast and internal)
        try {
          const [exists] = await file.exists();
          if (exists) {
            const [buf] = await file.download();
            sourceText = buf.toString('utf8');
          }
        } catch (inner) {
          // fallback to signed URL fetch later
          sourceText = null;
        }

        if (!sourceText) {
          // try fetching via signed URL (best-effort)
          try {
            const res = await fetch((await file.getSignedUrl({ action: 'read', expires: new Date(Date.now() + 60 * 1000) }))[0]);
            if (res.ok) sourceText = await res.text();
          } catch (fetchErr) {
            // ignore
          }
        }

        if (!sourceText) throw new Error('Could not fetch source content for PDF rendering');

        // Build a simple HTML wrapper
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Evidence Pack</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;margin:32px;color:#111}pre{white-space:pre-wrap;word-break:break-word;background:#fafafa;border:1px solid #eee;padding:12px;border-radius:6px;font-family:monospace;font-size:11px}</style>
          </head><body><h1>Evidence Pack</h1><pre>${escapeHtml(sourceText)}</pre></body></html>`;

        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        // Set content and wait until network idle (but bound by timeout)
        await Promise.race([
          page.setContent(html, { waitUntil: 'networkidle0' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Puppeteer setContent timeout')), PDF_RENDER_TIMEOUT_MS)),
        ]);
        const pdfBuffer = await Promise.race([
          page.pdf({ format: 'A4', printBackground: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Puppeteer PDF timeout')), PDF_RENDER_TIMEOUT_MS)),
        ]);
        await browser.close();

        // Upload PDF to a deterministic path: replace extension with .pdf under same folder
        const pdfPath = filePath.replace(/\.(json|md|txt)$/i, '.pdf');
        const pdfFile = bucket.file(pdfPath);
        await pdfFile.save(pdfBuffer, { contentType: 'application/pdf' });

        // Update invocation doc metadata if we have invocationId
        if (invocationId) {
          try {
            const invRef = db.collection('evidencePackInvocations').doc(invocationId);
            await invRef.update({ pdfStoragePath: `gs://${bucketName}/${pdfPath}`, pdfCreatedAt: admin.firestore.FieldValue.serverTimestamp(), pdfSignedUrl: null });
          } catch (uerr) {
            // ignore update errors
            console.warn('Could not update invocation with pdfStoragePath', uerr);
          }
        }

        // Generate signed URL for the newly uploaded PDF
        const expiresSecondsLocal = Number(process.env.TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS || 3600);
        const expiresAtLocal = new Date(Date.now() + expiresSecondsLocal * 1000);
        const [pdfSignedUrl] = await pdfFile.getSignedUrl({ action: 'read', expires: expiresAtLocal });

        // If this was a per-test-case invocation, update the per-test-case audit doc with PDF info
        if (invocationId && typeof testCaseId === 'string') {
          try {
            const auditRef = db.collection('evidencePackInvocations').doc(invocationId).collection('testCaseAudit').doc(testCaseId);
            await auditRef.update({ pdfStoragePath: `gs://${bucketName}/${pdfPath}`, pdfSignedUrl, pdfCreatedAt: admin.firestore.FieldValue.serverTimestamp() });
          } catch (uerr) {
            // if doc doesn't exist, create it with minimal info
            try {
              await db.collection('evidencePackInvocations').doc(invocationId).collection('testCaseAudit').doc(testCaseId).set({ pdfStoragePath: `gs://${bucketName}/${pdfPath}`, pdfSignedUrl, pdfCreatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            } catch (inner) {
              console.warn('Could not write testCaseAudit pdf info', inner);
            }
          }
        }

        // Also update invocation doc with pdfSignedUrl (best-effort)
        if (invocationId) {
          try {
            const invRef = db.collection('evidencePackInvocations').doc(invocationId);
            await invRef.update({ pdfSignedUrl, pdfStoragePath: `gs://${bucketName}/${pdfPath}`, pdfCreatedAt: admin.firestore.FieldValue.serverTimestamp() });
          } catch (uerr) {
            console.warn('Could not update invocation with pdfSignedUrl', uerr);
          }
        }

        return NextResponse.json({ signedUrl: pdfSignedUrl, storagePath: `gs://${bucketName}/${pdfPath}`, expiresAt: expiresAtLocal.toISOString(), generatedPdf: true });
      } catch (pdfErr) {
        console.warn('On-demand PDF generation failed', pdfErr);
        // fall through to return the existing signed URL for the original file
      }
    }

    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

    return NextResponse.json({ signedUrl, storagePath: finalStoragePath, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('Regenerate signed url error', err);
    return NextResponse.json({ error: String(err && (err.message || err)) }, { status: 500 });
  }
}
