import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const db = admin.firestore();
    const reqDoc = await db.collection('requirements').doc(id).get();
    if (!reqDoc.exists) return NextResponse.json({ exists: false });
    const data = reqDoc.data();
    const nextSeq = data?.nextTestCaseSeq || null;

    // fetch latest few test cases for this requirement
    const tcsSnap = await db.collection('testCases').where('requirementId', '==', id).orderBy('createdAt','desc').limit(20).get();
    const testCases = tcsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ exists: true, id, nextTestCaseSeq: nextSeq, testCases });
  } catch (e) {
    console.error('debug requirement read failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
