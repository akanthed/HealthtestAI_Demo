import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = admin.firestore();
    const testDocId = `debug-${Date.now()}`;
    await db.collection('adminDebug').doc(testDocId).set({
      ok: true,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    const projectId = admin.app().options?.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || null;

    return NextResponse.json({ ok: true, projectId, testDocId });
  } catch (e) {
    const errMsg = (e && typeof e === 'object' && 'message' in e) ? String((e as any).message) : String(e);
    console.error('Debug admin write failed:', errMsg);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
