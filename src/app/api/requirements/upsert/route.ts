import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { admin } from '@/lib/firebase-admin';

const db = admin.firestore();

function normalizeText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hashText(normalized: string) {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requirementText = (body.requirementText || body.text || '') as string;
    const title = (body.title || '').toString();
    if (!requirementText || requirementText.trim().length === 0) {
      return NextResponse.json({ error: 'requirementText is required' }, { status: 400 });
    }

    const normalized = normalizeText(requirementText);
    const normalizedHash = hashText(normalized);

    // 1) Check for existing requirement by normalizedHash
    let reqQ;
    try {
      reqQ = await db.collection('requirements').where('normalizedHash', '==', normalizedHash).limit(1).get();
    } catch (permErr: any) {
      console.error('Firestore read failed in requirements/upsert:', permErr);
      // Detect permission denied
      if (permErr && (permErr.code === 7 || /permission/i.test(String(permErr.message || '')))) {
        return NextResponse.json({ error: 'permission_denied', message: 'Firestore permission denied. Ensure the service account used by firebase-admin has Firestore permissions (roles/datastore.user or similar).' }, { status: 403 });
      }
      // Detect index-required by parsing the error message for the Console URL
      const msg = String(permErr.message || permErr);
      const m = msg.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/i);
      const indexUrl = m ? m[0] : null;
      return NextResponse.json({ error: 'check_failed', reason: 'index_required', indexUrl, message: msg }, { status: 412 });
    }
    if (!reqQ.empty) {
      const doc = reqQ.docs[0];
      const requirementId = doc.id;

      // Fetch test cases linked to this requirement (limit 200)
      const tcsSnap = await db.collection('testCases').where('requirementId', '==', requirementId).orderBy('createdAt', 'desc').limit(200).get();
      const testCases = tcsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return NextResponse.json({ existing: true, requirementId, testCases });
    }

    // 2) Create a new requirement id using a global counter doc 'counters/requirements'
    const countersRef = db.collection('counters').doc('requirements');
    let newReqId = '';

    await db.runTransaction(async (tx) => {
      const countersSnap = await tx.get(countersRef);
      let seq = 1;
      if (!countersSnap.exists) {
        tx.set(countersRef, { seq: 1 });
        seq = 1;
      } else {
        const data = countersSnap.data();
        seq = (data?.seq || 0) + 1;
        tx.update(countersRef, { seq });
      }

      const reqNum = String(seq).padStart(3, '0');
      newReqId = `REQ${reqNum}`;

      const reqRef = db.collection('requirements').doc(newReqId);
      tx.set(reqRef, {
        title: title || (requirementText.slice(0, 120)),
        text: requirementText,
        description: requirementText, // added for downstream consistency
        normalizedHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nextTestCaseSeq: 1,
      });
    });

    return NextResponse.json({ existing: false, requirementId: newReqId });
  } catch (err: any) {
    console.error('requirements/upsert error', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export const runtime = 'nodejs';
