import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { isAuditAdmin } from '@/lib/audit';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function inferRequirementId(from: string): string | null {
  if (!from) return null;
  const m = String(from).match(/REQ[-_ ]?(\d{1,})/i);
  if (m) return 'REQ' + m[1].padStart(3,'0');
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!isAuditAdmin(decoded)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(()=>({}));
    const limit = Math.min(5000, Math.max(1, Number(body.limit || 1000)));
    const dryRun = !!body.dryRun;

    const snap = await db.collection('testCases').limit(limit).get();
    let updates = 0;
    const details: Array<{ id: string; from?: string | null; inferred?: string | null; action: string; }> = [];
    const batch = db.batch();
    for (const doc of snap.docs) {
      const data = doc.data() as any;
      const current = data.requirementId || null;
      // Prefer explicit legacy field values if present
      const legacy = data.requirement_id || data.requirementID || null;
      let inferred: string | null = null;
      if (!current) {
        if (legacy) {
          inferred = inferRequirementId(String(legacy)) || String(legacy);
        } else {
          inferred = inferRequirementId(doc.id) || inferRequirementId(String(data.sourceId || ''));
        }
      }
      if (!current && inferred) {
        details.push({ id: doc.id, from: current, inferred, action: dryRun ? 'would_update' : 'update' });
        updates++;
        if (!dryRun) batch.update(doc.ref, { requirementId: inferred });
      }
    }
    if (!dryRun && updates > 0) await batch.commit();
    return NextResponse.json({ ok: true, dryRun, examined: snap.size, updates, details });
  } catch (e: any) {
    console.error('backfill requirement ids error', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export const runtime = 'nodejs';