import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  // Query params: ?testCaseId=... or ?invocationId=...
  const url = new URL(req.url);
  const testCaseId = url.searchParams.get('testCaseId');
  const invocationId = url.searchParams.get('invocationId');

  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const rows: string[] = [];
  // header
  rows.push(['testCaseId', 'invocationId', 'storagePath', 'signedUrl', 'checksum', 'snapshotAt'].join(','));

  try {
    if (testCaseId) {
      const histRef = db.collection('traceability').doc(testCaseId).collection('history').orderBy('snapshotAt', 'asc');
      const snap = await histRef.get();
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push([testCaseId, data.invocationId || '', data.storagePath || '', data.signedUrl || '', data.checksum || '', data.snapshotAt ? data.snapshotAt.toDate().toISOString() : ''].map(escapeCsv).join(','));
      });
    } else if (invocationId) {
      const invRef = db.collection('evidencePackInvocations').doc(invocationId).collection('testCaseAudit');
      const snap = await invRef.get();
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push([data.testCaseId || d.id, invocationId, data.storagePath || '', data.signedUrl || '', data.checksum || '', data.snapshotAt ? data.snapshotAt.toDate().toISOString() : ''].map(escapeCsv).join(','));
      });
    } else {
      // Export all auditLogs as fallback (limited to 1000)
      const snap = await db.collection('evidencePackInvocations').orderBy('createdAt', 'desc').limit(1000).get();
      for (const inv of snap.docs) {
        const invId = inv.id;
        const tSnap = await db.collection(`evidencePackInvocations/${invId}/testCaseAudit`).get();
        tSnap.forEach((d) => {
          const data = d.data() as any;
          rows.push([data.testCaseId || d.id, invId, data.storagePath || '', data.signedUrl || '', data.checksum || '', data.snapshotAt ? data.snapshotAt.toDate().toISOString() : ''].map(escapeCsv).join(','));
        });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const csv = rows.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="traceability-export-${Date.now()}.csv"`,
    },
  });
}

function escapeCsv(v: any) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('\"') || s.includes('\n')) return '"' + s.replace(/\"/g, '\"\"') + '"';
  return s;
}
