import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { signAuditLog, isRecentAuth, isAuditAdmin } from '@/lib/audit';

/**
 * POST /api/audit/sign
 * Body: { auditId: string, reason?: string }
 * Requires Authorization: Bearer <ID Token>
 * Rules:
 *  - User must be audit admin (reuse same policy) OR record owner (future enhancement)
 *  - ID token must have recent auth_time (<=5m default) for signature ceremony
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';  
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;  
    if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    if (!admin.apps.length) admin.initializeApp();
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(token, true); // checkRevoked: false, but pass true to ensure latest (re-auth) claims considered
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const body = await req.json();
    const { auditId, reason } = body || {};
    if (!auditId) return NextResponse.json({ error: 'auditId required' }, { status: 400 });

    const authTime = decoded?.auth_time as number | undefined;
    if (!isRecentAuth(authTime)) {
      return NextResponse.json({ error: 'Re-authentication required (stale auth_time)' }, { status: 401 });
    }

    // For now restrict to audit admins only (could extend to owner-based signers later)
    if (!isAuditAdmin(decoded)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sig = await signAuditLog({
      auditId,
      signerUserId: decoded.uid,
      signerEmail: decoded.email || 'unknown',
      reason,
      authTime,
      method: 'password-reentry',
    });
    return NextResponse.json({ ok: true, signature: sig });
  } catch (e: any) {
    console.error('audit sign error', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
