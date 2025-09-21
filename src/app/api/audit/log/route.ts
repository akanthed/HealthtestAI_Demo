import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { writeAuditLog, isAuditAdmin } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    if (!admin.apps.length) admin.initializeApp();
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!isAuditAdmin(decoded)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { actionType, entityType, entityId, oldValues, newValues, metadata } = body || {};
    if (!actionType || !entityType) return NextResponse.json({ error: 'actionType and entityType required' }, { status: 400 });
    const result = await writeAuditLog({
      actionType,
      entityType,
      entityId: entityId || null,
      userId: decoded.uid || null,
      userEmail: decoded.email || null,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: req.headers.get('x-forwarded-for') || null,
      userAgent: req.headers.get('user-agent') || null,
      sessionId: decoded.session_id || null,
      metadata: metadata || null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('audit log error', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
