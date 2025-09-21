 'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin } from '@/lib/firebase-admin';
import { expandStandards, formatTags, normalizeInput, formatTag } from '@/config/standards';
import traceabilityHelper from '@/lib/traceability';

const GenerateEvidencePackInputSchema = z.object({
  standards: z.array(z.string()),
  dateRange: z.object({ from: z.string(), to: z.string() }),
});
export type GenerateEvidencePackInput = z.infer<typeof GenerateEvidencePackInputSchema>;

const GenerateEvidencePackOutputSchema = z.object({
  report: z.string(),
  signedUrl: z.string().optional(),
  mdSignedUrl: z.string().optional(),
  pdfSignedUrl: z.string().optional(),
  traceability: z.record(z.object({
    storagePaths: z.array(z.string()).optional(),
    signedUrls: z.array(z.string()).optional(),
    checksum: z.string().optional(),
    canonicalTags: z.array(z.string()).optional(),
    originalTags: z.array(z.string()).optional(),
    snapshotRef: z.string().optional(),
  })).optional(),
});
export type GenerateEvidencePackOutput = z.infer<typeof GenerateEvidencePackOutputSchema>;

export async function generateEvidencePack(input: GenerateEvidencePackInput): Promise<GenerateEvidencePackOutput> {
  return generateEvidencePackFlow(input);
}

const generateEvidencePackFlow = ai.defineFlow(
  {
    name: 'generateEvidencePackFlow',
    inputSchema: GenerateEvidencePackInputSchema,
    outputSchema: GenerateEvidencePackOutputSchema,
  },
  async (input) => {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();

    let { standards, dateRange } = input;

    // Expand user-friendly inputs into canonical stored tags (e.g. 'HIPAA' -> 'HIPAA_164.312')
    const expandedStandards: string[] = expandStandards(standards);

    let query: admin.firestore.Query = db.collection('testCases');
    query = query.where('status', '==', 'approved');
    if (expandedStandards.length > 0) {
      // Firestore limits array-contains-any to 10 entries; trim if necessary.
      const toUse = expandedStandards.slice(0, 10);
      query = query.where('complianceTags', 'array-contains-any', toUse);
    }
  if (dateRange?.from) query = query.where('createdAt', '>=', new Date(dateRange.from));
  if (dateRange?.to) query = query.where('createdAt', '<=', new Date(dateRange.to));
  // order to match composite index (createdAt DESC)
  query = query.orderBy('createdAt', 'desc');

  let testCases: any[] = [];
  let scannedCount = 0;
  let usedFallback = false;
    try {
  const snapshot = await query.get();
  scannedCount = snapshot.size || snapshot.docs.length || 0;
  testCases = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (err: any) {
      const msg = String(err && (err.message || err));
      // If Firestore requires an index, fall back to a createdAt-only query and filter in-memory.
      if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')) {
        // Fallback: query by createdAt range only (if provided), with a reasonable limit to avoid scanning entire collection.
        let fallbackQuery: admin.firestore.Query = db.collection('testCases');
  if (dateRange?.from) fallbackQuery = fallbackQuery.where('createdAt', '>=', new Date(dateRange.from));
  if (dateRange?.to) fallbackQuery = fallbackQuery.where('createdAt', '<=', new Date(dateRange.to));
  // order + apply a limit to protect from huge scans; adjust as needed
  fallbackQuery = fallbackQuery.orderBy('createdAt', 'desc').limit(1000);
  const fbSnap = await fallbackQuery.get();
  usedFallback = true;
  scannedCount = fbSnap.size || fbSnap.docs.length || 0;
        // Build a set of normalized requested tokens and canonical display labels to match against.
        const requestedInputs = (standards || []).map(normalizeInput).filter(Boolean);
        const requestedCanonical = expandedStandards || [];
        const requestedCanonicalDisplay = requestedCanonical.map((c) => normalizeInput(formatTag(c)));
        const requested = Array.from(new Set([...requestedInputs, ...requestedCanonicalDisplay]));

        const matchesRequested = (tag: string) => {
          if (!tag) return false;
          const nt = normalizeInput(tag);
          for (const r of requested) {
            if (!r) continue;
            if (nt === r) return true;
            if (nt.includes(r) || r.includes(nt)) return true;
          }
          return false;
        };

        testCases = fbSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((tc) => {
            if (!tc) return false;
            if ((tc.status || '').toString().toLowerCase() !== 'approved') return false;
            if (requested.length === 0) return true;
            const tags = Array.isArray(tc.complianceTags)
              ? tc.complianceTags
              : Array.isArray(tc.complianceStandards)
              ? tc.complianceStandards
              : [];
            if (!tags || tags.length === 0) return false;
            for (const t of tags) {
              if (matchesRequested(t)) return true;
            }
            return false;
          });
      } else {
        throw err;
      }
    }

    let report = 'Compliance Evidence Pack\n';
    report += '========================\n\n';
    report += `Generated on: ${new Date().toUTCString()}\n`;
    report += `Date Range: ${new Date(dateRange.from).toLocaleDateString()} to ${new Date(dateRange.to).toLocaleDateString()}\n`;
    report += `Standards Included: ${standards && standards.length > 0 ? standards.join(', ') : 'All'}\n\n`;
    report += `--- Approved Test Cases (${testCases.length}) ---\n\n`;

    const fmtDate = (val: any) => {
      if (!val) return 'N/A';
      if (val.seconds && typeof val.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
      if (val instanceof Date) return val.toISOString();
      try {
        return new Date(val).toISOString();
      } catch (e) {
        return String(val);
      }
    };

  for (const tc of testCases) {
      const title = tc.title || tc.name || 'Untitled';
      const description = tc.description || tc.body || '';
      const priority = tc.priority || 'normal';
      const complianceTags = Array.isArray(tc.complianceTags) ? tc.complianceTags : Array.isArray(tc.complianceStandards) ? tc.complianceStandards : [];
      report += `ID: ${tc.id}\n`;
      report += `Title: ${title}\n`;
      report += `Description: ${description}\n`;
      report += `Priority: ${priority}\n`;
      report += `Compliance Tags: ${complianceTags.join(', ')}\n`;
      report += `Approved On: ${fmtDate(tc.createdAt)}\n`;
      report += `------------------------------------\n\n`;
    }

    if (testCases.length === 0) report += 'No approved test cases found for the selected criteria.';

      // Debug logging to help understand why main query vs fallback produced different results
      try {
        const sampleIds = testCases.slice(0, 10).map((t) => t.id);
        console.log('[generateEvidencePack] usedFallback=', usedFallback, 'scannedCount=', scannedCount, 'matchedCount=', testCases.length, 'sampleIds=', sampleIds);
      } catch (e) {
        // ignore logging errors
      }

    const bucketName = process.env.TRACEABILITY_BUCKET;
    let signedUrl: string | undefined;
    let mdSignedUrl: string | undefined;
    let pdfSignedUrl: string | undefined;
  // prepare traceability structure
  const traceability: Record<string, any> = {};
  const invocationId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const invocationRef = db.collection('evidencePackInvocations').doc(invocationId);
  // flag to indicate any history writes were skipped due to non-strict mode
  let historyWritesSkipped = false;
  // baseKey for storage artifacts; declared here so we can re-use it when re-uploading augmented markdown
  let baseKey: string | undefined;
    // initial invocation doc
    try {
      await invocationRef.set({
        invocationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        input: { standards: standards || [], dateRange: dateRange || null },
        usedFallback: !!usedFallback,
        scannedCount: scannedCount || 0,
        matchedCount: testCases.length || 0,
      });
    } catch (e) {
      console.warn('Could not write initial invocation doc', e);
    }

    if (bucketName) {
      try {
  const storage = admin.storage();
  const bucket = storage.bucket(bucketName);
  const rand = Math.random().toString(36).slice(2, 8);
  baseKey = `evidence-packs/${Date.now()}-${rand}`;

        try {
          // Before uploading the markdown, append a Traceability & Audit section summarizing per-test-case
          // artifacts (storage paths, signed urls, checksums, and snapshot refs). We'll build this after
          // per-test-case uploads below, so skip here and re-upload the md after test-case processing.
          // For now create a provisional mdKey; we'll overwrite it later with the augmented report.
          const mdKey = `${baseKey}.md`;
          const bucketNameStr = bucketName as string;
          // initially upload the current report so there's at least something; we'll re-upload the augmented one later
          const uploaded = await traceabilityHelper.uploadJsonSnapshot(bucketNameStr, mdKey, { report });
          mdSignedUrl = uploaded.signedUrl;
          signedUrl = mdSignedUrl;
          try { await invocationRef.update({ mdStoragePath: uploaded.storagePath, mdSignedUrl: uploaded.signedUrl, mdChecksum: uploaded.checksum }); } catch (e) {}
          traceability['__report'] = traceability['__report'] || { storagePaths: [], signedUrls: [] };
          traceability['__report'].storagePaths.push(uploaded.storagePath);
          traceability['__report'].signedUrls.push(uploaded.signedUrl);
        } catch (err) {
          report += `\n\nNote: Could not upload Markdown report to TRACEABILITY_BUCKET (${String(err)}).`;
        }

        const wantPdf = String(process.env.GENERATE_PDF || '').toLowerCase();
        if (wantPdf === '1' || wantPdf === 'true') {
          const cloudRunUrl = process.env.CLOUDRUN_PDF_URL;
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>Evidence Pack</title></head><body><pre style="font-family: monospace; white-space: pre-wrap;">${report.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
          if (cloudRunUrl) {
            try {
              const axios = (await import('axios')).default;
              const body = { html, bucket: bucketName.replace(/^gs:\/\//, ''), keyPrefix: baseKey };
              const resp = await axios.post(cloudRunUrl, body, { timeout: 120000 });
              if (resp && resp.data && resp.data.pdfUrl) {
                pdfSignedUrl = resp.data.pdfUrl;
                signedUrl = pdfSignedUrl || signedUrl;
              } else {
                report += `\n\nNote: Cloud Run PDF worker responded without pdfUrl`;
              }
            } catch (err) {
              report += `\n\nNote: Cloud Run PDF worker call failed: ${String(err)}`;
            }
          } else {
            try {
              const puppeteerModule: any = await import('puppeteer');
              const puppeteer = puppeteerModule.default || puppeteerModule;
              const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
              const page = await browser.newPage();
              await page.setContent(html, { waitUntil: 'networkidle0' });
              const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
              await browser.close();

              const pdfKey = `${baseKey}.pdf`;
              const bucketNameStr = bucketName as string;
              const uploadedPdf = await traceabilityHelper.uploadBuffer(bucketNameStr, pdfKey, pdfBuffer, 'application/pdf');
              pdfSignedUrl = uploadedPdf.signedUrl;
              signedUrl = pdfSignedUrl || signedUrl;
              try { await invocationRef.update({ pdfStoragePath: uploadedPdf.storagePath, pdfSignedUrl: uploadedPdf.signedUrl, pdfChecksum: uploadedPdf.checksum }); } catch (u) {}
              traceability['__report'] = traceability['__report'] || { storagePaths: [], signedUrls: [] };
              traceability['__report'].storagePaths.push(uploadedPdf.storagePath);
              traceability['__report'].signedUrls.push(uploadedPdf.signedUrl);
            } catch (err) {
              report += `\n\nNote: PDF generation disabled or failed (puppeteer missing or error): ${String(err)}`;
            }
          }
        }
      } catch (err) {
        report += `\n\nNote: Could not upload report to TRACEABILITY_BUCKET (${String(err)}).`;
      }
    } else {
      report += `\n\nNote: TRACEABILITY_BUCKET not configured; report not uploaded.`;
    }

    // For each test case, save a per-test-case snapshot to storage and a reference in invocation subcollection
    try {
      if (bucketName && testCases && testCases.length > 0) {
        const storage = admin.storage();
        const bucket = storage.bucket(bucketName);
        const crypto = await import('crypto');
        for (const tc of testCases) {
          try {
            const tcId = tc.id || (`tc-${Math.random().toString(36).slice(2, 8)}`);
            const snapshot = { id: tcId, snapshotAt: new Date().toISOString(), data: tc };
            const tcKey = traceabilityHelper.storagePathForTestCase(invocationId, tcId);
            try {
              const uploaded = await traceabilityHelper.uploadJsonSnapshot(bucketName as string, tcKey, snapshot, Number(process.env.TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS || 3600));
              try {
                await invocationRef.collection('testCaseAudit').doc(tcId).set({
                  testCaseId: tcId,
                  storagePath: uploaded.storagePath,
                  signedUrl: uploaded.signedUrl,
                  checksum: uploaded.checksum,
                  canonicalTags: Array.isArray(tc.complianceTags) ? tc.complianceTags : [],
                  originalTags: Array.isArray(tc.complianceTagsOriginal) ? tc.complianceTagsOriginal : [],
                  snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              } catch (werr) {
                console.warn('Failed writing testCaseAudit subdoc for', tcId, werr);
              }
              // Also update central traceability/{testCaseId} doc so TraceabilityPanel can show pack snapshots
              try {
                const traceRef = db.collection('traceability').doc(tcId);
                await traceRef.set({
                  testCaseId: tcId,
                  lastSnapshot: {
                    invocationId,
                    storagePath: uploaded.storagePath,
                    signedUrl: uploaded.signedUrl,
                    checksum: uploaded.checksum,
                    snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
                }, { merge: true });
                // Also write an immutable history entry for this snapshot
                try {
                  const histRef = traceRef.collection('history').doc(invocationId + '-' + tcId);
                  // Transactionally create the history doc only if it does not exist
                  await db.runTransaction(async (tx) => {
                    const snap = await tx.get(histRef);
                    if (snap.exists) {
                      throw new Error(`History doc already exists for ${tcId} / ${invocationId}`);
                    }
                    tx.set(histRef, {
                      invocationId,
                      testCaseId: tcId,
                      storagePath: uploaded.storagePath,
                      signedUrl: uploaded.signedUrl,
                      checksum: uploaded.checksum,
                      snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: false });
                  });
                } catch (histErr) {
                  // Make transactional behavior configurable via TRACE_HISTORY_STRICT
                  // Default: strict mode (errors rethrown). If TRACE_HISTORY_STRICT is set to '0' or 'false',
                  // log a warning and continue (skip history write) instead of failing the whole flow.
                  const strictFlag = String(process.env.TRACE_HISTORY_STRICT || 'true').toLowerCase();
                  const strict = !(strictFlag === '0' || strictFlag === 'false');
                  if (strict) {
                    console.error('Failed writing traceability history (transaction) for', tcId, histErr);
                    throw histErr;
                  } else {
                    console.warn('Skipping traceability history write for', tcId, 'due to non-strict mode:', String(histErr));
                    historyWritesSkipped = true;
                    try { await invocationRef.update({ historyWritesSkipped: true }); } catch (u) { /* ignore */ }
                  }
                }
              } catch (terr) {
                console.warn('Failed updating central traceability doc for', tcId, terr);
              }
              traceability[tcId] = {
                storagePaths: [uploaded.storagePath],
                signedUrls: [uploaded.signedUrl],
                checksum: uploaded.checksum,
                canonicalTags: Array.isArray(tc.complianceTags) ? tc.complianceTags : [],
                originalTags: Array.isArray(tc.complianceTagsOriginal) ? tc.complianceTagsOriginal : [],
                snapshotRef: `evidencePackInvocations/${invocationId}/testCaseAudit/${tcId}`,
              };
            } catch (uerr) {
              console.warn('Failed processing test case for traceability', uerr);
            }
          } catch (tcerr) {
            console.warn('Failed processing test case for traceability', tcerr);
          }
        }
        try {
          await invocationRef.update({ traceabilitySummary: Object.keys(traceability).length, matchedCount: testCases.length });
        } catch (u) {
          // ignore
        }
      } else {
        // even if no bucket or testcases, write a summary
        try {
          await invocationRef.update({ traceabilitySummary: 0, matchedCount: testCases.length });
        } catch (u) {}
      }
    } catch (err) {
      console.warn('Traceability persist failed', err);
    }

    // After we've gathered traceability entries for each test case, append a Traceability & Audit section
    // to the original markdown report and re-upload it so downloads include the traceability mapping.
    try {
      // Build a compact JSON manifest from traceability (omit internal '__report' entry)
      const manifest: Record<string, any> = { invocationId, generatedAt: new Date().toISOString(), entries: {} };
      for (const [k, v] of Object.entries(traceability)) {
        if (k === '__report') continue;
        const t = v as any;
        // find the original test case to get a title/short description
        const found = (testCases || []).find((x: any) => x && (x.id === k || x.id === (t.testCaseId || null)));
        const title = (found && (found.title || found.name)) || (t && t.title) || 'Untitled';
        const rawDesc = (found && (found.description || found.body)) || (t && t.description) || '';
        const shortDescription = rawDesc ? (rawDesc.toString().slice(0, 160) + (rawDesc.toString().length > 160 ? '...' : '')) : '';
        manifest.entries[k] = {
          title,
          shortDescription,
          storagePaths: Array.isArray(t.storagePaths) ? t.storagePaths : (t.storagePath ? [t.storagePath] : []),
          signedUrls: Array.isArray(t.signedUrls) ? t.signedUrls : (t.signedUrl ? [t.signedUrl] : []),
          checksum: t.checksum || null,
          snapshotRef: t.snapshotRef || null,
        };
      }
      let manifestUploaded: any = null;
      // Build a full human-readable Traceability & Audit section and include manifest link
      const ids = Object.keys(traceability).filter((k) => k !== '__report');
      const traceLines = [] as string[];
      traceLines.push('\n\n---\nTraceability & Audit\n--------------------\n');
      traceLines.push(`Invocation ID: ${invocationId}\n`);
      traceLines.push(`Matched Test Cases: ${ids.length}\n\n`);
      for (const id of ids) {
        const t = traceability[id] as any;
        traceLines.push(`Test Case ID: ${id}\n`);
        if (t.title) traceLines.push(`Title: ${t.title}\n`);
        if (t.shortDescription) traceLines.push(`Short Description: ${t.shortDescription}\n`);
        if (t.snapshotRef) traceLines.push(`Snapshot Ref: ${t.snapshotRef}\n`);
        if (Array.isArray(t.storagePaths) && t.storagePaths.length) traceLines.push(`Storage Paths: ${t.storagePaths.join(', ')}\n`);
        if (Array.isArray(t.signedUrls) && t.signedUrls.length) traceLines.push(`Signed URLs: ${t.signedUrls.join(', ')}\n`);
        if (t.checksum) traceLines.push(`Checksum: ${t.checksum}\n`);
        if (Array.isArray(t.canonicalTags) && t.canonicalTags.length) traceLines.push(`Canonical Tags: ${t.canonicalTags.join(', ')}\n`);
        if (Array.isArray(t.originalTags) && t.originalTags.length) traceLines.push(`Original Tags: ${t.originalTags.join(', ')}\n`);
        traceLines.push('\n');
      }
      let augmentedReport = report + traceLines.join('');
      if (bucketName) {
        try {
          const bucketNameStr = bucketName as string;
          // upload manifest first so we can include its signed URL in the markdown
          try {
            const manifestKey = `${baseKey}.traceability.json`;
            manifestUploaded = await traceabilityHelper.uploadJsonSnapshot(bucketNameStr, manifestKey, manifest);
            try { await invocationRef.update({ manifestStoragePath: manifestUploaded.storagePath, manifestSignedUrl: manifestUploaded.signedUrl, manifestChecksum: manifestUploaded.checksum }); } catch (e) {}
          } catch (merr) {
            console.warn('Failed uploading traceability manifest', merr);
          }

          if (manifestUploaded && manifestUploaded.signedUrl) {
            augmentedReport = augmentedReport + `\n\nTraceability manifest: ${manifestUploaded.signedUrl}\n`;
          }

          const mdKey = `${baseKey}.md`;
          const uploadedAug = await traceabilityHelper.uploadJsonSnapshot(bucketNameStr, mdKey, { report: augmentedReport });
          mdSignedUrl = uploadedAug.signedUrl;
          signedUrl = mdSignedUrl || signedUrl;
          try { await invocationRef.update({ mdStoragePath: uploadedAug.storagePath, mdSignedUrl: uploadedAug.signedUrl, mdChecksum: uploadedAug.checksum, traceability }); } catch (e) {}
          // update traceability report entry as well
          traceability['__report'] = traceability['__report'] || { storagePaths: [], signedUrls: [] };
          traceability['__report'].storagePaths = Array.from(new Set([...(traceability['__report'].storagePaths || []), uploadedAug.storagePath]));
          traceability['__report'].signedUrls = Array.from(new Set([...(traceability['__report'].signedUrls || []), uploadedAug.signedUrl]));
          // make sure the returned report is the augmented one
          report = augmentedReport;
        } catch (err) {
          console.warn('Failed to re-upload augmented markdown report', err);
        }
      }
    } catch (err) {
      console.warn('Failed building augmented markdown traceability section', err);
    }

    return {
      report,
      signedUrl,
      mdSignedUrl,
      pdfSignedUrl,
      traceability,
      invocationId,
    } as unknown as GenerateEvidencePackOutput & { invocationId: string };
  }
);
