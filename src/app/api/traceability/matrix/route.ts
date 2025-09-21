import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Simple in-memory cache (per server instance) – acceptable for short TTL aggregate.
interface CacheEntry { data: any; expires: number; }
let cache: CacheEntry | null = null;
const TTL_MS = Number(process.env.TRACEABILITY_MATRIX_TTL_MS || 60_000); // default 60s

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
    const includeOrphans = url.searchParams.get('orphans') !== '0';
  const filterRidRaw = url.searchParams.get('rid');
  const filterRidNorm = filterRidRaw ? filterRidRaw.replace(/[^a-z0-9]/gi,'').toUpperCase() : null;

    if (!force && cache && cache.expires > Date.now()) {
      return NextResponse.json({ ok: true, cached: true, ttlRemainingMs: cache.expires - Date.now(), ...cache.data });
    }

    // Fetch requirements (limit large usage; for now assume <5k; add pagination later)
    let reqSnap;
    if (filterRidNorm) {
      // Direct doc lookup then wrap to mimic snapshot shape
      const doc = await db.collection('requirements').doc(filterRidRaw!).get();
      const docs: any[] = [];
      if (doc.exists) docs.push(doc);
      reqSnap = { docs } as any;
    } else {
      reqSnap = await db.collection('requirements').orderBy('createdAt', 'desc').limit(5000).get();
    }
    const normalizeId = (v: string) => v ? v.replace(/[^a-z0-9]/gi,'').toUpperCase() : v;

  const requirements: Array<{ id: string; title?: string; text?: string; createdAt?: string; norm: string; }> = reqSnap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || null,
        text: data.text || null,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
        norm: normalizeId(d.id),
      };
    });

    // Fetch recent test cases (limit 20k for now – tune / paginate for scale)
    const tcSnap = await db.collection('testCases').orderBy('createdAt', 'desc').limit(20000).get();
  const testCases = tcSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // Build mapping requirementId -> testCaseIds + statuses
    const byRequirement: Record<string, { testCaseIds: string[]; statuses: Record<string, number>; originalIds: Set<string>; }> = {};
    const inferReqFromTcId = (id: string) => {
      // Patterns: REQ001TC002 / REQ001-TC002 / REQ-001TC003 etc.
      if (!id) return null;
      const m = id.match(/REQ[-_ ]?(\d{1,})/i);
      if (m) return 'REQ' + m[1].padStart(3,'0');
      return null;
    };

    // Track legacy field usage for diagnostics
    let legacyFieldHits = 0;
    for (const tc of testCases) {
      // Accept multiple historical variants of the requirement link field
      let ridRaw: any = (tc as any).requirementId || (tc as any).requirement_id || (tc as any).requirementID || null;

      if (!ridRaw) {
        // attempt inference from test case id itself (pattern REQ### in id)
        const inferred = inferReqFromTcId(tc.id);
        if (inferred) {
          ridRaw = inferred;
        }
      }

      if (!ridRaw) continue;

      if (!(tc as any).requirementId && ((tc as any).requirement_id || (tc as any).requirementID)) {
        legacyFieldHits++;
      }

      const ridNorm = normalizeId(String(ridRaw));
      if (!byRequirement[ridNorm]) byRequirement[ridNorm] = { testCaseIds: [], statuses: {}, originalIds: new Set() };
      byRequirement[ridNorm].testCaseIds.push(tc.id);
      const st = tc.status || 'unknown';
      byRequirement[ridNorm].statuses[st] = (byRequirement[ridNorm].statuses[st] || 0) + 1;
      byRequirement[ridNorm].originalIds.add(String(ridRaw));
    }

    // Determine coverage status per requirement
    const rows = requirements.map(r => {
      const entry = byRequirement[r.norm];
      const total = entry ? entry.testCaseIds.length : 0;
      let status: string;
      if (!entry || total === 0) status = 'uncovered';
      else if (entry.statuses['approved'] && entry.statuses['approved'] === total) status = 'fully_approved';
      else if (entry.statuses['approved']) status = 'partially_approved';
      else status = 'in_progress';
      return {
        requirementId: r.id,
        title: r.title,
        testCaseIds: entry ? entry.testCaseIds : [],
        counts: entry ? entry.statuses : {},
        total,
        coverageStatus: status,
        originalRequirementIdValues: entry ? Array.from(entry.originalIds) : [],
      };
    });

    // Optionally include orphan test cases (those with no requirementId) for diagnostics
    let orphanTestCases: string[] | undefined;
    if (includeOrphans) {
      orphanTestCases = testCases.filter(tc => !tc.requirementId).map(tc => tc.id);
    }

    // Coverage summary
    const totalRequirements = requirements.length;
    const covered = rows.filter(r => r.total > 0).length;
    const fullyApproved = rows.filter(r => r.coverageStatus === 'fully_approved').length;
    const uncovered = rows.filter(r => r.coverageStatus === 'uncovered').length;

    const summary = {
      totalRequirements,
      coveredRequirements: covered,
      fullyApprovedRequirements: fullyApproved,
      uncoveredRequirements: uncovered,
      coveragePercent: totalRequirements > 0 ? (covered / totalRequirements) * 100 : 0,
      fullyApprovedPercent: totalRequirements > 0 ? (fullyApproved / totalRequirements) * 100 : 0,
    };

    // If single requirement filter, trim summary to just that scope
    let payloadRows = rows;
    if (filterRidNorm) {
      payloadRows = rows.filter(r => r.requirementId.replace(/[^a-z0-9]/gi,'').toUpperCase() === filterRidNorm);
    }
    const scopedSummary = filterRidNorm && payloadRows.length === 1 ? {
      totalRequirements: 1,
      coveredRequirements: payloadRows[0].total > 0 ? 1 : 0,
      fullyApprovedRequirements: payloadRows[0].coverageStatus === 'fully_approved' ? 1 : 0,
      uncoveredRequirements: payloadRows[0].coverageStatus === 'uncovered' ? 1 : 0,
      coveragePercent: payloadRows[0].total > 0 ? 100 : 0,
      fullyApprovedPercent: payloadRows[0].coverageStatus === 'fully_approved' ? 100 : 0,
    } : summary;

    const payload = { ok: true, cached: false, rows: payloadRows, summary: scopedSummary, orphanTestCases, diagnostics: { legacyRequirementFieldHits: legacyFieldHits, filtered: !!filterRidNorm }, generatedAt: new Date().toISOString(), limitHints: { maxRequirements: 5000, maxTestCases: 20000 } };
    cache = { data: payload, expires: Date.now() + TTL_MS };
    return NextResponse.json(payload);
  } catch (e: any) {
    console.error('traceability matrix error', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export const revalidate = 0; // dynamic (we handle caching manually)
export const runtime = 'nodejs';