import { admin } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { sanitizeObject } from '@/lib/sanitize';

/** Firestore collection name for audit logs */
export const AUDIT_COLLECTION = 'auditLogs';

export interface AuditLogInput {
  actionType: string;               // e.g. requirement.updated, testcase.executed
  entityType: string;               // requirement | testCase | review | compliance | system | system
  entityId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any> | null;          // additional context: diff, approval state, etc.
}

export interface AuditSignatureInfo {
  signerUserId: string;
  signerEmail: string;
  signedAt: string;          // ISO timestamp of signature event
  reason?: string;           // Free-text reason / meaning of signature
  authTime?: number;         // Firebase auth_time of re-auth (seconds since epoch)
  method: 'password-reentry' | 'mfa' | 'delegated' | 'admin-override';
  hash: string;              // Hash of the original (pre-signature) canonical audit record
  signature: string;         // HMAC or future asymmetric signature blob
  algorithm: string;         // e.g. HMAC-SHA256
  version: number;           // Schema version for forward compatibility
}

export interface AuditLogStored extends AuditLogInput {
  id: string;
  timestamp: admin.firestore.FieldValue | string; // Firestore server timestamp field value
  tsIso?: string;                                 // High precision ISO string
  hash: string;                                   // SHA256 of canonical record
  prevHash?: string | null;                       // Previous record hash (chain)
  chainIntegrity?: 'ok' | 'start';
  signature?: AuditSignatureInfo | null;          // Populated only after electronic signature ceremony
}

/**
 * Canonicalize a JSON object for hashing - stable sort keys.
 */
function canonicalJson(obj: any): string {
  if (obj === null || obj === undefined) return String(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

/**
 * Compute SHA256 hash of canonical form.
 */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Writes an audit log entry, chaining with previous entry hash for tamper evidence.
 * Returns stored document ID & hash.
 */
// Optional BigQuery mirroring (best-effort)
let bq: any = null;
const projectId = process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || null;
const BQ_DATASET = process.env.BQ_DATASET || null;
const BQ_AUDIT_TABLE = process.env.BQ_AUDIT_TABLE || null;
try {
  if (projectId && BQ_DATASET && BQ_AUDIT_TABLE) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BigQuery } = require('@google-cloud/bigquery');
    bq = new BigQuery({ projectId });
  }
} catch {
  bq = null;
}

/**
 * Writes an audit log entry with integrity chain and optional BigQuery mirror.
 */
export async function writeAuditLog(entry: AuditLogInput): Promise<{ id: string; hash: string; }>{
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  let prevHash: string | null = null;
  try {
    const prevSnap = await db.collection(AUDIT_COLLECTION).orderBy('timestamp', 'desc').limit(1).get();
    if (!prevSnap.empty) prevHash = (prevSnap.docs[0].data() as any).hash || null;
  } catch { /* ignore */ }

  const now = new Date();
  let tsIso = now.toISOString();
  try {
    const hr = process.hrtime.bigint();
    const micro = Number(hr % BigInt(1_000_000));
    tsIso = tsIso.replace('Z', '') + `.${micro.toString().padStart(6,'0')}Z`;
  } catch { /* noop */ }

  const base: Omit<AuditLogStored,'id'|'hash'> = {
    ...entry,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    tsIso,
    prevHash,
    chainIntegrity: prevHash ? 'ok' : 'start',
    signature: null,
  };
  const canonical = canonicalJson(base);
  const hash = sha256(canonical);
  const ref = db.collection(AUDIT_COLLECTION).doc();
  await ref.set({ ...base, hash });

  // BigQuery mirror (non-blocking)
  if (bq && projectId && BQ_DATASET && BQ_AUDIT_TABLE) {
    (async () => {
      try {
        const row = {
          event_id: ref.id,
            user_id: entry.userId || null,
            user_email: entry.userEmail || null,
            action_type: entry.actionType,
            resource_type: entry.entityType,
            resource_id: entry.entityId || null,
            before_value: entry.oldValues || null,
            after_value: entry.newValues || null,
            ip_address: entry.ipAddress || null,
            user_agent: entry.userAgent || null,
            session_id: entry.sessionId || null,
            timestamp: now.toISOString(),
            metadata: entry.metadata || null,
            hash,
            prev_hash: prevHash,
        };
        await bq.dataset(String(BQ_DATASET)).table(String(BQ_AUDIT_TABLE)).insert([row], { ignoreUnknownValues: true });
      } catch (e: any) {
        console.warn('Audit BigQuery mirror failed', e && (e.message || e));
      }
    })();
  }

  return { id: ref.id, hash };
}

/**
 * Determine if a Firebase ID token's auth_time (seconds) is recent enough to be considered
 * an active re-auth for electronic signature purposes (default 5 minutes as per common policy).
 */
export function isRecentAuth(authTime?: number, maxAgeSeconds = 300): boolean {
  if (!authTime) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return (nowSec - authTime) <= maxAgeSeconds;
}

/**
 * Sign an existing audit log entry (21 CFR Part 11 style electronic signature stub).
 * Requirements:
 *  - Caller must have performed a recent re-auth (auth_time freshness validated externally or passed in)
 *  - Audit record must exist and not already be signed
 *  - Signature computed as HMAC-SHA256 over `${hash}|${signerUserId}|${signedAt}|${reason || ''}`
 */
export async function signAuditLog({
  auditId,
  signerUserId,
  signerEmail,
  reason,
  authTime,
  method = 'password-reentry',
  maxAuthAgeSeconds = 300,
}: {
  auditId: string;
  signerUserId: string;
  signerEmail: string;
  reason?: string;
  authTime?: number; // seconds since epoch from Firebase token
  method?: AuditSignatureInfo['method'];
  maxAuthAgeSeconds?: number;
}): Promise<AuditSignatureInfo> {
  if (!admin.apps.length) admin.initializeApp();
  if (!isRecentAuth(authTime, maxAuthAgeSeconds)) {
    throw new Error('Stale or missing re-auth (auth_time) for electronic signature');
  }
  const db = admin.firestore();
  const ref = db.collection(AUDIT_COLLECTION).doc(auditId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Audit record not found');
  const data = snap.data() as AuditLogStored;
  if (data.signature) throw new Error('Audit record already signed');

  const signingSecret = process.env.SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('SIGNING_SECRET not set - generating ephemeral key (NOT suitable for production verification)');
  }
  const secret = signingSecret || crypto.randomBytes(32).toString('hex');
  const signedAt = new Date().toISOString();
  const baseString = `${data.hash}|${signerUserId}|${signedAt}|${reason || ''}`;
  const hmac = crypto.createHmac('sha256', secret).update(baseString).digest('hex');
  const sig: AuditSignatureInfo = {
    signerUserId,
    signerEmail,
    signedAt,
    reason,
    authTime,
    method,
    hash: data.hash,
    signature: hmac,
    algorithm: 'HMAC-SHA256',
    version: 1,
  };

  await ref.update({ signature: sig });
  return sig;
}

/**
 * Verifies chain integrity of most recent N logs.
 */
export async function verifyAuditChain(limit = 100): Promise<{ ok: boolean; breakAt?: string; count: number; }>{
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection(AUDIT_COLLECTION).orderBy('timestamp', 'desc').limit(limit).get();
  const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  let prev: string | null = null;
  for (const d of docs) {
    if (prev && d.hash !== prev) {
      return { ok: false, breakAt: d.id, count: docs.length };
    }
    prev = d.prevHash || null;
  }
  return { ok: true, count: docs.length };
}

/**
 * Helper to build an audit record diff snapshot (shallow).
 */
export function diffShallow(oldObj: Record<string, any> | null | undefined, newObj: Record<string, any> | null | undefined) {
  const changed: Record<string, { old: any; new: any }> = {};
  const keys = new Set([...(oldObj ? Object.keys(oldObj) : []), ...(newObj ? Object.keys(newObj) : [])]);
  for (const k of keys) {
    const o = oldObj ? oldObj[k] : undefined;
    const n = newObj ? newObj[k] : undefined;
    if (JSON.stringify(o) !== JSON.stringify(n)) changed[k] = { old: o, new: n };
  }
  return changed;
}

/**
 * RBAC utility: determine whether decoded token qualifies for audit admin.
 */
export function isAuditAdmin(decoded: any): boolean {
  const adminEmail = String(process.env.TRACEABILITY_ADMIN_EMAIL || '').toLowerCase();
  const email = (decoded?.email || '').toLowerCase();
  return !!decoded?.admin || (!!adminEmail && email === adminEmail);
}

/** Firestore index recommendation (add to indexes configuration):
 * collection: auditLogs
 *  - timestamp DESC
 *  - actionType + timestamp DESC (optional)
 *  - entityType + entityId + timestamp DESC
 */
/** Query audit logs with optional filters. */
export async function queryAuditLogs({ entityType, entityId, from, to, limit = 100, actionType }: { entityType?: string; entityId?: string; from?: string; to?: string; limit?: number; actionType?: string; }) {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  let q: FirebaseFirestore.Query = db.collection(AUDIT_COLLECTION);
  if (entityType) q = q.where('entityType', '==', entityType);
  if (entityId) q = q.where('entityId', '==', entityId);
  if (actionType) q = q.where('actionType', '==', actionType);
  if (from) q = q.where('timestamp', '>=', new Date(from));
  if (to) q = q.where('timestamp', '<=', new Date(to));
  q = q.orderBy('timestamp', 'desc').limit(limit);
  const snap = await q.get();
  return snap.docs.map(d => {
    const data = d.data() as any;
    const safe = sanitizeObject(data || {});
    return { id: d.id, ...safe };
  });
}

export default { writeAuditLog, verifyAuditChain, queryAuditLogs, diffShallow, isAuditAdmin, signAuditLog, isRecentAuth };
