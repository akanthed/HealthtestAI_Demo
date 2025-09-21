# Audit & Traceability System

This document summarizes the implementation of the traceability & audit trails features aligned with healthcare / regulated software guidelines (FDA 21 CFR Part 11, IEC 62304, ISO 13485, HIPAA, GDPR).

## Features Implemented

### 1. Audit Log Infrastructure
- Firestore collection: `auditLogs` (append-only)
- Fields (core): `actionType`, `entityType`, `entityId`, `userId`, `userEmail`, `oldValues`, `newValues`, `timestamp` (server), `ipAddress`, `userAgent`, `sessionId`, `metadata`
- Integrity: Each record stores `hash` (SHA256 of canonical JSON) and `prevHash` for tamper-evident chain.
- High precision timestamp: `tsIso` attempts microsecond precision by appending high-resolution timing.
- Optional BigQuery mirroring (best-effort, asynchronous) when `PROJECT_ID`, `BQ_DATASET`, `BQ_AUDIT_TABLE` set.

### 2. Helper Module (`src/lib/audit.ts`)
- `writeAuditLog(entry)` – writes chained log + optional BQ mirror.
- `verifyAuditChain(limit)` – checks that hashes chain correctly (recent window).
- `queryAuditLogs(filters)` – filtered retrieval (entityType, entityId, actionType, date range, limit).
- `diffShallow(old,new)` – quick change diff helper.
- `isAuditAdmin(decodedToken)` – RBAC (admin claim or `TRACEABILITY_ADMIN_EMAIL`).

### 3. API Endpoints
| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/audit/log` | POST | Write an audit log | Firebase ID token (admin) |
| `/api/audit/recent` | GET | Fetch filtered recent logs | Firebase ID token (admin) |
| `/api/audit/sign` | POST | Apply electronic signature to existing audit record | Firebase ID token (admin + recent re-auth) |

Auth expectation: `Authorization: Bearer <Firebase ID token>`; user must have `admin:true` custom claim or email matches env `TRACEABILITY_ADMIN_EMAIL`.

### 4. UI Components
- `AuditTrailModal` – On-demand modal showing recent audit logs with refresh & CSV export (client side fetch to `/api/audit/recent`).
- `AuditTimeline` – Vertical timeline view (stylized).
- `TraceabilityMatrix` – Placeholder table for requirement ↔ test case mappings.
- `ComplianceReport` – Summary card grid for standards compliance coverage.
- `SearchFilters` – Filter bar (entity, action, date range) – wiring stub provided.
- `ExportDialog` – Simple CSV exporter (client-side only for now).
- Dashboard integration: Button on dashboard header triggers `AuditTrailModal`.

### 5. Traceability (Existing)
The earlier evidence pack & per-test-case snapshot system already generates artifacts, manifests, PDFs, and per-test-case audit snapshots. The new audit system complements it by adding *user & system action* logging separate from artifact provenance.

### 6. Electronic Signatures (Implemented - Initial Version)
Electronic signature support (21 CFR Part 11 style – initial lightweight phase) has been added:

Data model (`auditLogs.signature`):
```
{
  signerUserId: string,
  signerEmail: string,
  signedAt: ISOString,
  reason?: string,
  authTime?: number,
  method: 'password-reentry' | 'mfa' | 'delegated' | 'admin-override',
  hash: <original audit record hash>,
  signature: <HMAC over `${hash}|${signerUserId}|${signedAt}|${reason}`>,
  algorithm: 'HMAC-SHA256',
  version: 1
}
```

Workflow:
1. User performs a sensitive action (e.g., approval) – base audit log is created via `/api/audit/log`.
2. Frontend prompts for re-auth (Firebase `reauthenticateWithCredential`) to refresh ID token `auth_time`.
3. Client calls `POST /api/audit/sign` with `{ auditId, reason }` using the fresh ID token.
4. Server validates:
   - Token authenticity
   - `auth_time` freshness (<= 5 minutes default)
   - Admin authorization (current policy) and that record is unsigned
5. Server computes HMAC signature and persists under `signature` field.

Important Notes:
- Current signature secret: `SIGNING_SECRET` (HMAC). If absent, an ephemeral key is generated (NOT compliant—must set in production).
- Future enhancement: Replace HMAC with asymmetric signing (private key) + detached verification tool.
- Hash binding: Signature always ties to the original `hash` of the pre-signature canonical audit record (chain remains stable; signature addition is intentionally excluded from original hash to avoid recursion).
- Re-auth freshness threshold configurable via code (default 300s).

Client Example (pseudo):
```ts
// After reauth (credential prompt) -> get fresh token
const token = await auth.currentUser?.getIdToken(true);
await fetch('/api/audit/sign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ auditId: targetAuditId, reason: 'Formal approval of requirement change' })
});
```

Verification (server side): Compare stored `signature` against recomputed HMAC using `SIGNING_SECRET`.

### 7. Roadmap (Updated)
The roadmap has been adjusted to reflect completed signature basics and pending hardening.

## Not Implemented Yet / Roadmap
| Feature | Description | Priority |
|---------|-------------|----------|
| Strengthened signatures | Asymmetric key pair, hardware KMS, detached verification tool | High |
| Signature audit UI | Dedicated UI to view signature metadata & verify live | High |
| Immutable retention policy | Export & WORM storage / periodic integrity verification | High |
| Full diff viewer for requirements | Rich side-by-side diff with highlight & version rollback | Medium |
| Advanced filters & pagination | Cursor-based pagination + composite indexes | Medium |
| Gap analysis automation | Compute compliance coverage & risk weighting | Medium |
| Role-based fine-grained scopes | Distinguish read audit vs write audit privileges | Medium |
| Cryptographic signing | Private key signature of log hash (external verification) | Medium |
| UI accessibility review | WCAG 2.1 full audit & keyboard flows | Medium |
| PDF export for audit log | Server-rendered PDF (like evidence pack PDF flow) | Low |

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `TRACEABILITY_ADMIN_EMAIL` | Grants admin if email matches (fallback to custom claim). |
| `PROJECT_ID` / `GCLOUD_PROJECT` | Project ID for BigQuery client. |
| `BQ_DATASET` | BigQuery dataset (optional). |
| `BQ_AUDIT_TABLE` | BigQuery table (optional). |
| `SIGNING_SECRET` | HMAC key for electronic signatures (required for stable verification). |

## Firestore Index Suggestions
Add composite indexes (pseudo-config):
```
collection: auditLogs
  orderBy: timestamp desc
collection: auditLogs
  where: entityType == ; orderBy: timestamp desc
collection: auditLogs
  where: entityType == ; where: entityId == ; orderBy: timestamp desc
collection: auditLogs
  where: actionType == ; orderBy: timestamp desc
```

## Security & Integrity Notes
- Chain integrity ensures tamper becomes evident; run `verifyAuditChain()` periodically (Cloud Scheduler / background function) and alert on failure.
- Consider exporting finalized daily logs to immutable storage (Cloud Storage bucket with Object Versioning + retention lock) for regulatory audits.
- To harden further: add asymmetric signing with a dedicated service account key; store public key for external verifier.

## Example: Writing an Audit Log (Server)
```ts
import { writeAuditLog } from '@/lib/audit';

await writeAuditLog({
  actionType: 'requirement.updated',
  entityType: 'requirement',
  entityId: reqId,
  userId: user.uid,
  userEmail: user.email,
  oldValues: { title: prevTitle },
  newValues: { title: nextTitle },
  metadata: { diff: { title: { old: prevTitle, new: nextTitle } } }
});
```

## Client Fetch Example
```ts
const token = await auth.currentUser?.getIdToken();
const res = await fetch('/api/audit/recent?entityType=testCase&limit=25', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
```

## CSV Export
Implemented client-side only in `ExportDialog` (no server round-trip). For large exports build a streaming endpoint using BigQuery or Firestore pagination.

## Performance Considerations
- Firestore read patterns limited to recent 50–200 logs in UI; use pagination for long history.
- BigQuery mirroring is asynchronous to avoid UI latency; failures are logged but non-fatal.
- Hash calculation uses canonical JSON; large objects increase CPU cost—keep `oldValues/newValues` concise (or hash large payloads separately).

## Testing Checklist
## Traceability Matrix API
Endpoint: `GET /api/traceability/matrix`

Purpose: Aggregates `requirements` and `testCases` collections to produce requirement → test case coverage rows.

Response Shape (excerpt):
```json
{
  "ok": true,
  "rows": [
    {
      "requirementId": "REQ001",
      "title": "<title>",
      "testCaseIds": ["REQ001TC001", "REQ001TC002"],
      "counts": { "approved": 1, "generated": 1 },
      "total": 2,
      "coverageStatus": "partially_approved"
    }
  ],
  "summary": { "totalRequirements": 10, "coveredRequirements": 7, ... },
  "generatedAt": "2025-09-21T12:34:56.789Z"
}
```

Coverage Status Rules:
- `uncovered`: no linked test cases
- `in_progress`: at least one test case, none approved
- `partially_approved`: some approved, not all
- `fully_approved`: all linked test cases have status `approved`

Caching: In-memory per instance with TTL (`TRACEABILITY_MATRIX_TTL_MS`, default 60s). Pass `?force=1` to bypass cache. `?orphans=0` to omit orphan test cases (those lacking `requirementId`).

Scaling Roadmap:
- Add pagination / streaming for >5k requirements or >20k test cases
- Support filtering (e.g., only uncovered)
- Add historical snapshots (daily coverage trend)

- Create logs via POST `/api/audit/log`.
- Fetch recent logs and verify ordering & hash chain continuity.
- Modify a stored log manually (in console) and run `verifyAuditChain()` to ensure detection.
- Simulate BigQuery disabled / enabled flows.

## Next Steps (Suggested Implementation Order)
1. Add signature (private key) for each hash.
2. Implement electronic signature workflow for approvals (PIN/password re-entry + reason code).
3. Build requirement version diff viewer and link to each audit entry.
4. Add retention export (daily job) + integrity verification email alerts.
5. Replace client CSV export with streaming server export for large sets.

---
Maintained by: Traceability & Compliance subsystem.
