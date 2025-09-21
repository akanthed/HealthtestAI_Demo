import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
// @ts-ignore - pdfkit has no default exported types in plain TS setup without @types
import PDFDocument from 'pdfkit';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rid = url.searchParams.get('rid');

    let reqDocs: any[] = [];
    if (rid) {
      const r = await db.collection('requirements').doc(rid).get();
      if (r.exists) reqDocs.push(r);
    } else {
      const snap = await db.collection('requirements').orderBy('createdAt','desc').limit(200).get();
      reqDocs = snap.docs; // PDF smaller limit
    }

    // fetch test cases (basic; optimize later)
    const tcSnap = await db.collection('testCases').orderBy('createdAt','desc').limit(5000).get();
    const byReq: Record<string, any[]> = {};
    for (const d of tcSnap.docs) {
      const data = d.data() as any;
      const r = data.requirementId;
      if (!r) continue;
      (byReq[r] = byReq[r] || []).push({ id: d.id, status: data.status || '', title: data.title || '' });
    }

    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
  doc.on('data', (c: any) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(18).text('Traceability Matrix Export', { underline: true });
    doc.moveDown();
    if (rid) doc.fontSize(12).text(`Filtered Requirement: ${rid}`);
    doc.moveDown();

    for (const r of reqDocs) {
      const data = r.data() || {};
      const ridVal = r.id;
      const tcs = byReq[ridVal] || [];
      const statuses = tcs.reduce((acc: Record<string,number>, tc) => { acc[tc.status] = (acc[tc.status]||0)+1; return acc; }, {});
      doc.fontSize(14).text(`${ridVal} - ${data.title || ''}`);
      doc.fontSize(10).text(`Test Cases: ${tcs.length}`);
      doc.fontSize(10).text(`Statuses: ${Object.entries(statuses).map(([k,v])=>k+':'+v).join(', ') || 'None'}`);
      if (tcs.length) {
        doc.moveDown(0.3);
        tcs.slice(0,25).forEach(tc => {
          doc.fontSize(9).text(`• ${tc.id} [${tc.status}] ${tc.title}`);
        });
        if (tcs.length > 25) doc.fontSize(8).text(`... ${tcs.length - 25} more not shown`);
      }
      doc.moveDown();
      if (doc.page.height - doc.y < 120) doc.addPage();
    }

    doc.end();
    const pdfBuffer = await done;
  const res = new NextResponse(pdfBuffer as any, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="traceability${rid?'-'+rid:''}.pdf"` } });
  return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';
