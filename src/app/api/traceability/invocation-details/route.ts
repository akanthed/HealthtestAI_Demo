import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const invocationId = url.searchParams.get('invocationId');
    if (!invocationId) return NextResponse.json({ error: 'invocationId required' }, { status: 400 });

    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    const invSnap = await db.collection('evidencePackInvocations').doc(invocationId).get();
    if (!invSnap.exists) return NextResponse.json({ error: 'invocation not found' }, { status: 404 });
    const invocation = invSnap.data();

    const auditSnap = await db.collection(`evidencePackInvocations/${invocationId}/testCaseAudit`).get();
    const audit = auditSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ invocation: { id: invSnap.id, ...(invocation as any) }, audit });
  } catch (err: any) {
    console.error('invocation-details error', err);
    return NextResponse.json({ error: String(err && (err.message || err)) }, { status: 500 });
  }
}
