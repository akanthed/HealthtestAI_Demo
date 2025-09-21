import { NextRequest, NextResponse } from 'next/server';
import audit from '@/lib/audit';
import { admin } from '@/lib/firebase-admin';

async function isAdminRequest(req: NextRequest) {
  // RBAC: verify Firebase ID token and require one of:
  //  - custom claim `admin: true`, or
  //  - the user's email is listed in ADMIN_USERS env.
  // For developer convenience, ADMIN_USERS='*' is allowed only when NODE_ENV !== 'production'.
  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return false;
    const idToken = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded) return false;

    // If custom claim `admin` is set, allow
    if ((decoded as any).admin === true) return true;

    // Otherwise, check ADMIN_USERS env list
    const adminEnv = String(process.env.ADMIN_USERS || '');
    if (adminEnv === '*') {
      // allow wildcard only in non-production dev mode
      if (process.env.NODE_ENV !== 'production') return true;
      return false;
    }
    if (decoded.email && adminEnv.split(',').map(s => s.trim()).filter(Boolean).includes(decoded.email)) return true;
    return false;
  } catch (e) {
    // verification failed
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    const url = new URL(req.url);
    const entityType = url.searchParams.get('entityType') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const limit = Number(url.searchParams.get('limit') || '100');
    const rows = await audit.queryAuditLogs({ entityType, entityId, from, to, limit });
    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error('audit-logs GET failed', err);
    return NextResponse.json({ error: String(err && (err.message || err)) }, { status: 500 });
  }
}
