import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function csvEscape(v: any): string { if (v==null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rid = url.searchParams.get('rid');

    let reqQuery;
    if (rid) {
      const rdoc = await db.collection('requirements').doc(rid).get();
      reqQuery = rdoc.exists ? [rdoc] : [];
    } else {
      const snap = await db.collection('requirements').orderBy('createdAt','desc').limit(5000).get();
      reqQuery = snap.docs;
    }

    // prefetch test cases (basic approach; could be optimized by filtering if rid provided)
    const tcSnap = await db.collection('testCases').orderBy('createdAt','desc').limit(20000).get();
    const byReq: Record<string, any[]> = {};
    for (const d of tcSnap.docs) {
      const data = d.data() as any;
      const r = data.requirementId;
      if (!r) continue;
      (byReq[r] = byReq[r] || []).push({ id: d.id, status: data.status || '', title: data.title || '' });
    }

    const header = ['RequirementID','Title','TestCaseCount','TestCaseIds','Statuses'].join(',');
    const lines = [header];
    for (const rdoc of reqQuery) {
      const data = rdoc.data() as any || {};
      const ridVal = rdoc.id;
      const tcs = byReq[ridVal] || [];
      const statuses = tcs.reduce((acc: Record<string,number>, tc) => { acc[tc.status] = (acc[tc.status]||0)+1; return acc; }, {});
      lines.push([
        csvEscape(ridVal),
        csvEscape(data.title || ''),
        tcs.length,
        csvEscape(tcs.map(t=>t.id).join(' ; ')),
        csvEscape(Object.entries(statuses).map(([k,v])=>k+':'+v).join(' ')),
      ].join(','));
    }

    const csv = lines.join('\n');
    return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="traceability${rid?'-'+rid:''}.csv"` } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';
