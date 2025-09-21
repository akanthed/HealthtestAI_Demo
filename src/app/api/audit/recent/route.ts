import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { queryAuditLogs, isAuditAdmin } from '@/lib/audit';

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const entityType = url.searchParams.get('entityType') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const actionType = url.searchParams.get('actionType') || undefined;
    const limit = Number(url.searchParams.get('limit') || 100);
    const logs = await queryAuditLogs({ entityType, entityId, from, to, limit, actionType });
    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    console.error('audit recent error', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
