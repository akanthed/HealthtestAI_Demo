import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { expandStandards, formatTag } from '@/config/standards';

// Ensure the centralized admin module ran and expose some diagnostics
try {
  const adminOptions = (admin.app().options || {}) as Record<string, any>;
  const resolvedProject = adminOptions.projectId || process.env.PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT;
  console.log('Server: admin app projectId:', resolvedProject || 'undefined');
  console.log('Server: GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not-set');
} catch (e) {
  console.log('Server: admin app not initialized yet or error reading admin options', e);
}

/**
 * Generates a human-readable, unique ID for a test case.
 * e.g., TC-20240729-143015-ab12
 */
function generateReadableId(prefix = 'TC') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${date}-${time}-${random}`;
}

export async function POST(req: NextRequest) {
  const functionUrl = process.env.GENERATE_TESTCASES_URL;
  console.log('GENERATE_TESTCASES_URL:', functionUrl);

  try {
    // 1. Verify Authorization header
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    // 2. Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);

    // 3. Read request body
    const body = await req.json();

    if (!functionUrl) {
      throw new Error('Missing GENERATE_TESTCASES_URL in environment');
    }

    // 4. Normalize payload keys (client may send camelCase) and forward to deployed Cloud Function
    const forwardBody: any = {
      ...body,
      userId: decoded.uid,
      userEmail: decoded.email,
    };

    // map camelCase -> snake_case as the function expects
    if (body.requirementText && !body.requirement_text) {
      forwardBody.requirement_text = body.requirementText;
      delete forwardBody.requirementText;
    }
    if (body.requirement_text && !forwardBody.requirement_text) {
      forwardBody.requirement_text = body.requirement_text;
    }

    // map testTypes -> test_types
    if (body.testTypes && !body.test_types) {
      forwardBody.test_types = body.testTypes;
      delete forwardBody.testTypes;
    }


    // 4.5 Early requirement existence validation (hardening) before invoking external function
    const providedRequirementId = body.requirementId || body.requirement_id || null;
    const mandateReq = String(process.env.REQUIREMENT_ID_MANDATORY || '0').toLowerCase() === '1';
    if (mandateReq && !providedRequirementId) {
      return NextResponse.json({ error: 'missing_requirement_id', message: 'Requirement ID is mandatory for test case generation (set REQUIREMENT_ID_MANDATORY=0 to disable).' }, { status: 400 });
    }
    if (providedRequirementId) {
      try {
        const reqSnap = await admin.firestore().collection('requirements').doc(String(providedRequirementId)).get();
        if (!reqSnap.exists) {
          return NextResponse.json({ error: 'invalid_requirement', message: `Requirement ${String(providedRequirementId)} does not exist` }, { status: 400 });
        }
      } catch (chkErr: any) {
        return NextResponse.json({ error: 'requirement_check_failed', message: chkErr?.message || String(chkErr) }, { status: 500 });
      }
    }

    const resp = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(forwardBody),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Function call failed: ${resp.status} ${errorText}`);
    }

  const data = await resp.json();

    // If the external function already persisted and returned testCaseIds, trust those and skip re-persisting.
    let persistedIds: string[] = [];
    const persistErrors: { id: string; error: any }[] = [];
    try {
      if (Array.isArray(data?.testCaseIds) && data.testCaseIds.length > 0) {
        // external function already wrote to Firestore and returned ids
        persistedIds = data.testCaseIds.map((id: any) => String(id));
        console.log('Server: external function already persisted test cases, ids:', persistedIds);
      } else {
        const maybeCases =
          (data && Array.isArray(data.test_cases) && data.test_cases) ||
          (data && Array.isArray(data.testCases) && data.testCases) ||
          (data && data.data && Array.isArray(data.data.test_cases) && data.data.test_cases) ||
          (data && data.data && Array.isArray(data.data.testCases) && data.data.testCases) ||
          (data && data.raw && Array.isArray(data.raw.testCases) && data.raw.testCases) ||
          null;

        if (Array.isArray(maybeCases) && maybeCases.length > 0) {
          console.log('Server: will attempt to persist', maybeCases.length, 'test cases');
          console.log('Server: decoded user', { uid: decoded?.uid, email: decoded?.email });
          try {
            console.log('Server: admin app projectId:', admin.app().options?.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT);
            console.log('Server: GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not-set');
          } catch (e) {
            console.warn('Server: could not read admin app options', e);
          }

          const db = admin.firestore();
          // Create an invocationId for this generation run so we can store per-invocation snapshots
          const randInv = Math.random().toString(36).slice(2, 8);
          const invocationId = `inv-${Date.now()}-${randInv}`;
          const invocationRef = db.collection('evidencePackInvocations').doc(invocationId);
          try {
            await invocationRef.set({ invocationId, createdAt: admin.firestore.FieldValue.serverTimestamp(), input: forwardBody, userId: decoded.uid, userEmail: decoded.email || null });
          } catch (ie) {
            console.warn('Failed to write generation invocation doc', ie);
          }
          // track if any history writes were skipped due to non-strict mode
          let historyWritesSkipped = false;
          const generationPrompt = data?.prompt || data?.prompt_text || forwardBody?.prompt || forwardBody?.prompt_text || null;
          const modelInfo = data?.model || data?.modelInfo || data?.model_info || data?.request?.model || null;
          for (const tc of maybeCases) {
            const originalModelId = tc && (tc.test_case_id || tc.id || tc.testCaseId || null);
            console.log('Server: persisting candidate test case (raw):', originalModelId || '<no-id>');
            
            const humanReadableId = generateReadableId();
            const docRef = db.collection('testCases').doc(humanReadableId);
            const chosenId = docRef.id;


            const normalizeReqId = (v: any) => {
              if (!v) return v;
              const str = String(v).trim();
              // Preserve canonical REQ### forms; if user passed with hyphen (e.g., REQ-001) unify to REQ001
              const m = str.match(/REQ[-_ ]?(\d{1,})/i);
              if (m) {
                return 'REQ' + m[1].padStart(3,'0');
              }
              return str;
            };

            const normalized: any = {
              id: chosenId,
              sourceId: originalModelId,
              title: tc.title || tc.name || tc.test_case_title || tc.testCaseTitle || '',
              description: tc.description || tc.desc || tc.test_case_description || tc.testCaseDescription || '',
              requirementId: normalizeReqId(tc.requirementId || tc.requirement_id || providedRequirementId || null),
              steps: Array.isArray(tc.steps) ? tc.steps : Array.isArray(tc.test_steps) ? tc.test_steps : Array.isArray(tc.testSteps) ? tc.testSteps : [],
              expectedResults: tc.expectedResults || tc.expected_results || tc.expectedResult || '',
              preconditions: tc.preconditions || tc.precondition || '',
              postconditions: tc.postconditions || '',
              priority: tc.priority || null,
              severity: tc.severity || null,
              test_data: tc.test_data || tc.testData || null,
              environment: tc.environment || null,
              automation_feasible: typeof tc.automation_feasible === 'boolean' ? tc.automation_feasible : (tc.automationFeasible ?? false),
              estimated_duration: tc.estimated_duration || tc.estimatedDuration || null,
              classificationTags: tc.classificationTags || tc.classification_tags || [],
              // complianceTags and iec class will be normalized into canonical identifiers below
              complianceTags: tc.complianceTags || tc.compliance_tags || [],
              iec_62304_class: tc.iec_62304_class || tc.iec62304Class || null,
              risk_level: tc.risk_level || null,
              traceability: tc.traceability || null,
              // NEW: persist standard references & evidence needed from various naming conventions
              standard_references: Array.isArray(tc.standard_references)
                ? tc.standard_references.filter((v: any) => typeof v === 'string' && v.trim())
                : Array.isArray(tc.standardReferences)
                  ? tc.standardReferences.filter((v: any) => typeof v === 'string' && v.trim())
                  : Array.isArray(tc.standards)
                    ? tc.standards.filter((v: any) => typeof v === 'string' && v.trim())
                    : [],
              evidence_needed: Array.isArray(tc.evidence_needed)
                ? tc.evidence_needed.filter((v: any) => typeof v === 'string' && v.trim())
                : Array.isArray(tc.evidenceNeeded)
                  ? tc.evidenceNeeded.filter((v: any) => typeof v === 'string' && v.trim())
                  : Array.isArray(tc.evidence)
                    ? tc.evidence.filter((v: any) => typeof v === 'string' && v.trim())
                    : [],
              status: 'generated',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              generatedBy: {
                uid: decoded.uid,
                email: decoded.email || null,
              },
            };


            // Normalize compliance tags to canonical codes using central helpers where possible.
            // Try the centralized expansion first, then fall back to simple heuristics.
            function normalizeTag(raw: string) {
              if (!raw || typeof raw !== 'string') return null;
              const s = raw.trim();
              try {
                const expanded = expandStandards([s]);
                if (expanded && expanded.length > 0) return expanded[0];
              } catch (e) {
                // fall through to heuristics
              }

              const up = s.toUpperCase();
              // detect GDPR / FDA mentions
              if (up.includes('GDPR') || up.includes('GENERAL DATA PROTECTION') || up.includes('DATA PROTECTION')) return 'GDPR';
              if (up.includes('FDA') || up.includes('FOOD AND DRUG') || up.includes('21 CFR')) return 'FDA';
              if (up.includes('HIPAA')) return 'HIPAA_164.312';
              if (up.includes('IEC') && up.includes('62304')) {
                if (up.includes('CLASS C') || /\bCLASS\s*C\b/.test(up) || /\bC\b/.test(up)) return 'IEC_62304_CLASS_C';
                return 'IEC_62304';
              }
              if (up.includes('ISO') && up.includes('14155')) return 'ISO_14155';
              if (up.includes('CLINICAL INVESTIGATION')) return 'ISO_14155';
              // fallback: return original trimmed string so unknown tags are preserved
              return s;
            }

            // apply normalization
            try {
              // Collect any incoming tag-like fields (support multiple naming conventions)
              const suppliedTags: any[] = [];
              const pushTags = (v: any) => {
                if (v == null) return;
                if (Array.isArray(v)) suppliedTags.push(...v);
                else suppliedTags.push(v);
              };

              pushTags(tc.complianceTags);
              pushTags(tc.compliance_tags);
              pushTags(tc.matching_standards);
              pushTags(tc.matchingStandards);

              const rawTags = suppliedTags.length > 0 ? suppliedTags : (normalized.complianceTags || []);
              // persist a copy of the original incoming tags for audit / UI
              normalized.complianceTagsOriginal = (rawTags || []).map((t: any) => (t == null ? null : String(t)));

              const mapped = rawTags.map((t: any) => normalizeTag(String(t))).filter(Boolean);
                // Note: explicit `risk_level` is preserved on the test case but no longer mapped into compliance tokens here.
              // canonical tokens
              const canonical = Array.from(new Set(mapped));
              normalized.complianceTags = canonical;
              // also provide human friendly labels for UI consumption using central formatter
              try {
                normalized.complianceLabels = (canonical as string[]).map((c: string) => formatTag(c) || c);
              } catch (e) {
                normalized.complianceLabels = canonical;
              }

              // normalize iec class into canonical token
              const iecRaw = normalized.iec_62304_class;
              if (iecRaw) {
                const iecStr = String(iecRaw).trim();
                if (/C/i.test(iecStr)) normalized.iec_62304_class = 'IEC_62304_CLASS_C';
                else normalized.iec_62304_class = iecStr;
              }
            } catch (e) {
              console.warn('Server: compliance tag normalization failed', String((e as any)?.message ?? e));
            }

              try {
                // If a requirementId is supplied in the candidate, attempt to write the test case
                // using per-requirement sequencing: REQ{reqNum}TC{seq}.
                if (normalized.requirementId) {
                    try {
                      // perform a transaction that increments requirement.nextTestCaseSeq and writes the test case
                      const reqRef = db.collection('requirements').doc(String(normalized.requirementId));
                      const createdTcId = await db.runTransaction(async (tx) => {
                        const reqSnap = await tx.get(reqRef);
                        if (!reqSnap.exists) {
                          throw new Error(`Requirement ${String(normalized.requirementId)} not found`);
                        }
                        const reqData: any = reqSnap.data() || {};
                        const nextSeq = (typeof reqData.nextTestCaseSeq === 'number' ? reqData.nextTestCaseSeq : 1);
                        const seq = nextSeq;
                        const reqNumMatch = String(normalized.requirementId).match(/REQ(\d+)/i);
                        const reqNum = reqNumMatch ? reqNumMatch[1] : String(reqData?.seq || '001');
                        const tcId = `REQ${reqNum}TC${String(seq).padStart(3, '0')}`;

                        // ensure id uniqueness by writing directly to the document id
                        const tcRef = db.collection('testCases').doc(tcId);

                        const toWrite = { ...normalized, id: tcId, requirementId: String(normalized.requirementId), createdAt: admin.firestore.FieldValue.serverTimestamp() };

                        // also create a traceability document linking the test case to the requirement
                        const traceRef = db.collection('traceability').doc(tcId);
                        const traceDoc = {
                          testCaseId: tcId,
                          requirementId: String(normalized.requirementId),
                          createdAt: admin.firestore.FieldValue.serverTimestamp(),
                          source: normalized.sourceId || null,
                          generationPrompt: generationPrompt || null,
                          modelInfo: modelInfo || null,
                          // include a truncated snippet of the model/candidate raw response for auditability
                          rawModelResponseSnippet: typeof tc === 'object' ? JSON.stringify(tc).slice(0, 2000) : String(tc).slice(0, 2000),
                          metadata: {
                            persistedBy: decoded?.uid || null,
                            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                          },
                        };

                        tx.set(tcRef, toWrite);
                        tx.set(traceRef, traceDoc);
                        tx.update(reqRef, { nextTestCaseSeq: seq + 1 });

                        return tcId;
                      });

                      // after successful transaction, record persisted id and attempt to store full raw model response
                      persistedIds.push(createdTcId);
                      console.log('Server: persisted (transaction) ', createdTcId);

                      try {
                        // use centralized traceability helper to upload snapshot and get signed url + checksum
                        const traceabilityHelper = await import('@/lib/traceability');
                        const bucketName = process.env.TRACEABILITY_BUCKET || `${admin.app().options?.projectId || process.env.GCLOUD_PROJECT}.appspot.com`;
                        // store under per-invocation path for better auditability
                        const key = traceabilityHelper.storagePathForTestCase(invocationId, createdTcId);
                        const uploaded = await traceabilityHelper.uploadJsonSnapshot(bucketName, key, tc, Number(process.env.TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS || String(60 * 60 * 24 * 30)));
                        try {
                          // update central traceability doc with a lastSnapshot pointing to this invocation
                          await db.collection('traceability').doc(createdTcId).set({
                            testCaseId: createdTcId,
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
                              const traceRef = db.collection('traceability').doc(createdTcId);
                              const histRef = traceRef.collection('history').doc(invocationId + '-' + createdTcId);
                              await db.runTransaction(async (tx) => {
                                const s = await tx.get(histRef);
                                if (s.exists) throw new Error(`History doc already exists for ${createdTcId} / ${invocationId}`);
                                tx.set(histRef, {
                                  invocationId,
                                  testCaseId: createdTcId,
                                  storagePath: uploaded.storagePath,
                                  signedUrl: uploaded.signedUrl,
                                  checksum: uploaded.checksum,
                                  snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                                  // record which invocation wrote this
                                  recordedByInvocation: invocationId,
                                }, { merge: false });
                              });
                            } catch (histErr) {
                              // Configurable behavior: default strict (rethrow). If TRACE_HISTORY_STRICT is '0' or 'false', warn and continue.
                              const strictFlag = String(process.env.TRACE_HISTORY_STRICT || 'true').toLowerCase();
                              const strict = !(strictFlag === '0' || strictFlag === 'false');
                              if (strict) {
                                console.error('Failed writing traceability history (transaction) for', createdTcId, histErr);
                                throw histErr;
                              } else {
                                console.warn('Skipping traceability history write for', createdTcId, 'due to non-strict mode:', String(histErr));
                                historyWritesSkipped = true;
                                try { await invocationRef.update({ historyWritesSkipped: true }); } catch (u) { /* ignore */ }
                              }
                            }
                        } catch (uerr) {
                          console.warn('Failed to update traceability doc with storage URL for', createdTcId, uerr);
                        }
                      } catch (storErr) {
                        console.warn('Failed to upload full model response to storage for', createdTcId, storErr);
                      }
                    } catch (txErr) {
                      const errMsg = (txErr && typeof txErr === 'object' && 'message' in txErr) ? String((txErr as any).message) : String(txErr);
                      console.warn('Admin transaction persist failed for requirementId', normalized.requirementId, errMsg);
                      // fallback to writing with generated humanReadableId
                      await docRef.set(normalized);
                      persistedIds.push(chosenId);
                    }
                } else {
                  // no requirementId provided; fallback to previous behavior
                  await docRef.set(normalized);
                  persistedIds.push(chosenId);
                  console.log('Server: persisted', chosenId);
                }
              } catch (err) {
                const errMsg = (err && typeof err === 'object' && 'message' in err) ? String((err as any).message) : String(err);
                console.warn('Admin persist failed for', chosenId, errMsg);
                persistErrors.push({ id: chosenId, error: errMsg });
              }
          }
          console.log(`Admin persisted ${persistedIds.length}/${maybeCases.length} generated test cases to Firestore.`);
        }
      }
    } catch (err) {
      console.warn('Error persisting generated test cases on server:', err);
    }

    // Attach persisted ids to response so the client knows what was written.
    try {
      if (!data || typeof data !== 'object') {
        return NextResponse.json({ _persistedIds: persistedIds });
      }

      // compute maybeCases again safely for the out payload length
      const outMaybeCases =
        (data && Array.isArray(data.test_cases) && data.test_cases) ||
        (data && Array.isArray(data.testCases) && data.testCases) ||
        (data && data.data && Array.isArray(data.data.test_cases) && data.data.test_cases) ||
        (data && data.data && Array.isArray(data.data.testCases) && data.data.testCases) ||
        (data && data.raw && Array.isArray(data.raw.testCases) && data.raw.testCases) ||
        [];

  const out = { ...data, _persistedIds: persistedIds, _persistErrors: persistErrors, _maybeCasesCount: Array.isArray(outMaybeCases) ? outMaybeCases.length : 0 };

  return NextResponse.json(out);
    } catch (err) {
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error('generateTestcases API proxy error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
