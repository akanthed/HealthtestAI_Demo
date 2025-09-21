// functions/src/generateTestCases.ts
import { admin } from './firebaseApp';
import { createEmbedding, callGenerativeModel } from './vertexClient';
import { retrieveTopClauses, bq } from './bigqueryClient';
import { BigQuery } from '@google-cloud/bigquery';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as functions from 'firebase-functions';
import { Request, Response } from 'express';  

const BQ_TESTCASES_TABLE = process.env.BQ_TESTCASES_TABLE || 'test_cases_analytics';
const BQ_DATASET = process.env.BQ_DATASET!;
const PROJECT = process.env.PROJECT_ID!;

setGlobalOptions({
  region: 'us-central1',
  // maxInstances: 10,
});

export const generateTestCases = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
  })
  .https.onRequest(async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. auth (optional if proxied)
      const uid = req.body?.userId || null;

      // 2. get requirement text (either directly passed or fetched)
      let requirementText = req.body?.requirementText;
      const requirementId = req.body?.requirementId;
      if (!requirementText && requirementId) {
        const doc = await admin.firestore().doc(`requirements/${requirementId}`).get();
        requirementText = doc.exists ? doc.data()?.description : null;
      }
      if (!requirementText) {
        res.status(400).json({ error: 'No requirement text' });
        return;
      }

      // 3. create embedding for requirement
      const emb = await createEmbedding(requirementText);
      if (!emb) throw new Error('Failed to create embedding');

      // 4. retrieve top clauses from BigQuery
      const clauses = await retrieveTopClauses(emb, 6); // returns rows with clause_id & clause_text & evidence_needed & cosine_sim

      // 5. build prompt - include numbered clause list with clause_ids
      const clauseSnippet = clauses
        .map((c: any, i: number) => `${i + 1}. [${c.clause_id}] ${String(c.clause_text).slice(0, 400)}`)
        .join('\n\n');
      const prompt = `You are a strict JSON-producing healthcare test case generator.
Requirement:
"""${requirementText}"""

Top compliance candidates:
${clauseSnippet}

Produce JSON: { "testCases":[ ... ] } as specified: ... (same schema as in earlier prompt).
Rules: Use only clause_id values shown above; do not invent ids. Return only valid JSON.`;

      // 6. call generative model
      const modelText = await callGenerativeModel(prompt, { temperature: 0.05, maxOutputTokens: 1200 });

      // 7. parse model response
      let parsed;
      try {
        parsed = JSON.parse(modelText);
      } catch (e) {
        throw new Error('Model returned non-JSON or malformed JSON: ' + modelText.slice(0, 1000));
      }

      // 8. validate clause ids referenced in parsed.testCases
      const allowedIds = new Set(clauses.map((c: any) => c.clause_id));
      for (const tc of parsed.testCases || []) {
        for (const m of tc.complianceMapping || []) {
          if (!allowedIds.has(m.clause_id)) {
            throw new Error(`Model referenced unknown clause_id: ${m.clause_id}`);
          }
        }
      }

      // 9. optional DLP - call your dlpDeidentify or DLP API for PHI (if needed). Skip if not required.

      // 10. persist test cases to Firestore
      const db = admin.firestore();
      const tcIds: string[] = [];
      for (const tc of parsed.testCases || []) {
        // Preserve model-provided id in `sourceId` but always create a new Firestore document
        // with an auto-generated id so we never overwrite previously generated cases.
        const sourceId = tc.id || null;
        const docRef = db.collection('testCases').doc();
        const id = docRef.id;
        await docRef.set({
          ...tc,
          id,
          sourceId,
          requirementId: requirementId || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tcIds.push(id);
      }

      // 11. insert analytics into BigQuery
      const bigq = new BigQuery({ projectId: PROJECT });
      await bigq.dataset(BQ_DATASET).table(BQ_TESTCASES_TABLE).insert({
        test_case_ids: tcIds,
        requirement_id: requirementId || null,
        ai_confidence_score: null,
        generated_at: new Date(),
        generation_method: 'vertex-gemini-rag',
        compliance_mappings: parsed.testCases?.map((t: any) => t.complianceMapping || []),
      });

      res.status(200).json({ ok: true, testCaseIds: tcIds, raw: parsed });
      return;
    } catch (err: any) {
      console.error('generateTestCases error:', err);
      // ensure we don't return the response object
      res.status(500).json({ error: err.message });
      return;
    }
  });

// // functions/src/generateTestCases.ts
// import * as functions from 'firebase-functions';
// import { admin } from './firebaseApp';
// import { BigQuery } from '@google-cloud/bigquery';
// import { DlpServiceClient } from '@google-cloud/dlp';
// import { setGlobalOptions } from 'firebase-functions/v2';
// import fetch from 'node-fetch';
// import { GoogleAuth } from 'google-auth-library';

// type GenerateRequest = {
//   requirementId?: string;
//   requirementText?: string;
//   options?: {
//     includeEdgeCases?: boolean;
//     maxTestCases?: number;
//     dlpPolicy?: 'redact' | 'tokenize' | 'encrypt' | 'none';
//   };
// };

// const projectIdEnv = process.env.PROJECT_ID || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
// if (!projectIdEnv) throw new Error('Missing PROJECT_ID env var');
// const PROJECT_ID = String(projectIdEnv);

// const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
// const VERTEX_MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash'; // Fixed: Updated to correct model
// const BQ_DATASET = process.env.BQ_DATASET || 'healthtest_ai_dataset';
// const BQ_COMPLIANCE_TABLE = process.env.BQ_COMPLIANCE_TABLE || 'compliance_standards';
// const BQ_TESTCASES_TABLE = process.env.BQ_TESTCASES_TABLE || 'test_cases_analytics';
// const DLP_PROJECT = process.env.DLP_PROJECT || PROJECT_ID;
// const KMS_KEY_NAME = process.env.KMS_KEY_NAME; // required for tokenization

// const bq = new BigQuery({ projectId: PROJECT_ID });
// const dlp = new DlpServiceClient();

// /** Small helper: keywords from text */
// function extractKeywords(text: string, limit = 12): string[] {
//   if (!text) return [];
//   const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
//   const words = cleaned.split(/\s+/).filter(Boolean).filter(w => w.length > 3);
//   const stop = new Set(['which','that','where','while','these','those','under','over','have','with','from','between','should','would','could','system','user']);
//   const freqs = new Map<string, number>();
//   for (const w of words) {
//     if (stop.has(w)) continue;
//     freqs.set(w, (freqs.get(w) || 0) + 1);
//   }
//   return Array.from(freqs.entries())
//     .sort((a,b) => b[1]-a[1])
//     .slice(0, limit)
//     .map(e => e[0]);
// }

// /** Query BigQuery for candidate compliance rows by keyword overlap */
// async function queryComplianceCandidates(keywords: string[], limit = 200) {
//   try {
//     if (!keywords || keywords.length === 0) {
//       // fallback: return top N rows
//       const sql = `SELECT * FROM \`${PROJECT_ID}.${BQ_DATASET}.${BQ_COMPLIANCE_TABLE}\` LIMIT @limit`;
//       const [rows] = await bq.query({ query: sql, params: { limit }, location: 'US' });
//       return rows as any[];
//     }

//     // BigQuery query: check overlap between keywords and stored keywords array
//     const sql = `
//       SELECT * FROM \`${PROJECT_ID}.${BQ_DATASET}.${BQ_COMPLIANCE_TABLE}\`
//       WHERE ARRAY_LENGTH(ARRAY(
//         SELECT k FROM UNNEST(keywords) k WHERE k IN UNNEST(@keywords)
//       )) > 0
//       LIMIT @limit
//     `;
//     const [rows] = await bq.query({ query: sql, params: { keywords, limit }, location: 'US' });
//     return rows as any[];
//   } catch (error) {
//     console.warn('BigQuery query failed, continuing without compliance candidates:', error);
//     return []; // Continue without compliance candidates rather than failing
//   }
// }

// /** Build the prompt for Vertex AI (Gemini). We instruct to return JSON only. */
// // function buildLLMPrompt(requirementText: string, candidates: any[], options: GenerateRequest['options']) {
// //   const maxTestCases = options?.maxTestCases ?? 6;
// //   const includeEdge = options?.includeEdgeCases ? 'Include edge and negative cases.' : '';
  
// //   const ctx = candidates.slice(0, 50).map((c: any) => {
// //     return {
// //       standard_id: c.standard_id,
// //       requirement_id: c.requirement_id,
// //       requirement_text: (c.requirement_text || '').replace(/\n/g, ' '),
// //       source_url: c.source_url
// //     };
// //   });

// //   const prompt = `
// // You are an AI assistant that generates structured software QA test cases for healthcare systems.
// // Input requirement:
// // ${requirementText}

// // Context: Candidate compliance requirements (array of objects):
// // ${JSON.stringify(ctx, null, 2)}

// // Tasks:
// // 1) Generate up to ${maxTestCases} detailed test cases (positive, negative, and edge). Use the requirement text to derive preconditions, steps and expected results.
// // 2) For each test case include suggestedCompliance: an array of matches using standard_id and requirement_id from the context where relevant, with a matchConfidence 0.0-1.0 and a one-sentence rationale.
// // 3) Each test case should have fields:
// //   - id (short unique like tc_...),
// //   - title,
// //   - description,
// //   - preconditions,
// //   - steps (ordered array),
// //   - expectedResults,
// //   - postconditions,
// //   - classificationTags (array of strings),
// //   - aiConfidence (0.0-1.0),
// //   - suggestedCompliance: [{ standard_id, requirement_id, matchConfidence, rationale }]

// // IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no explanatory text.
// // The response must start with { and end with }.

// // Output format:
// // { "testCases": [ { ... } ] }

// // ${includeEdge}
// // Be conservative and prefer high precision. Do not include any real patient identifiers; redact or replace with [REDACTED] if present.
// //   `.trim();

// //   return prompt;
// // }

// function buildLLMPrompt(requirementText: string, candidates: any[], options: GenerateRequest['options']) {
//   const maxTestCases = Math.max(1, (options?.maxTestCases ?? 1)); // start small
//   const includeEdge = options?.includeEdgeCases ? 'Also include 1 simple edge case.' : '';

//   // Build a tiny summary of candidates (max 3 short lines) instead of full JSON dump
//   const smallCtx = (candidates || []).slice(0, 3).map((c: any, idx: number) => {
//     const short = (c.requirement_text || c.title || c.standard_id || '').toString().replace(/\n/g, ' ');
//     return `${idx + 1}. ${short.slice(0, 140)}`;
//   }).join('\n');

//   const prompt = `
// You are an assistant that returns compact JSON only.

// Input requirement:
// ${requirementText}

// Context (short): ${smallCtx || 'none'}

// Task:
// Return a JSON object with a single key "testCases" whose value is an array with up to ${maxTestCases} test case objects.
// Each test case should include only these fields: id, title, description, steps (array), expectedResults (string).
// Keep each field short and precise.

// EXAMPLE OUTPUT (exact JSON, no extra text):
// { "testCases": [ { "id":"tc_1", "title":"Brief title", "description":"Brief desc", "steps":["step1","step2"], "expectedResults":"expected" } ] }

// ${includeEdge}
// Important: Do not include markdown or explanation. Return only valid JSON that starts with "{" and ends with "}".
// `.trim();

//   return prompt;
// }


// function extractContentFromCandidate(candidate: any): string | null {
//   if (!candidate) return null;

//   // Prefer aggregated parts if they exist
//   const parts = candidate?.content?.parts;
//   if (Array.isArray(parts) && parts.length > 0) {
//     const text = parts
//       .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
//       .filter(Boolean)
//       .join('\n')
//       .trim();
//     if (text.length > 0) return text;
//   }

//   // Fallback to first part text or plain content.text
//   const firstPartText = candidate?.content?.parts?.[0]?.text;
//   if (typeof firstPartText === 'string' && firstPartText.trim().length > 0) {
//     return firstPartText.trim();
//   }

//   const plain = candidate?.content?.text;
//   if (typeof plain === 'string' && plain.trim().length > 0) {
//     return plain.trim();
//   }

//   return null;
// }


// export async function callVertexAI(
//   prompt: string,
//   temperature = 0.1,
//   maxOutputTokens = 2048,
//   expectJson = true
// ) {
//   const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
//   let model = (process.env.VERTEX_MODEL || 'gemini-2.5-flash').trim();
//   model = model.replace(/^\/+/, '');

//   if (model.startsWith('models/')) model = model.replace(/^models\//, '');

//   console.log('=== VERTEX AI DEBUG START ===');
//   console.log('Model:', model);
//   console.log('Prompt length:', prompt.length);
//   console.log('Prompt preview:', prompt.slice(0, 500) + '...');

//   const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
//   const client = await auth.getClient();

//   const projectFromEnv =
//     process.env.PROJECT_ID ||
//     process.env.GCLOUD_PROJECT ||
//     process.env.GCP_PROJECT ||
//     process.env.GOOGLE_CLOUD_PROJECT;

//   const discovered = projectFromEnv || (await auth.getProjectId().catch(() => null));
//   if (!discovered) {
//     throw new Error('PROJECT_ID not resolved');
//   }
//   const project = discovered;

//   let modelPath = model;
//   if (!modelPath.startsWith('publishers/') && !modelPath.startsWith('projects/')) {
//     modelPath = `publishers/google/models/${modelPath}`;
//   }

//   // Construct URL respecting different modelPath formats
//   let url: string;
//   const base = `https://${location}-aiplatform.googleapis.com/v1`;
//   if (modelPath.startsWith('projects/')) {
//     url = `${base}/${modelPath}:generateContent`;
//   } else if (modelPath.startsWith('publishers/')) {
//     // publisher models under project location path (projects/<project>/locations/<location>/publishers/...)
//     url = `${base}/projects/${project}/locations/${location}/${modelPath}:generateContent`;
//   } else {
//     url = `${base}/projects/${project}/locations/${location}/${modelPath}:generateContent`;
//   }

//   console.log('Using modelPath:', modelPath);
//   console.log('Vertex AI request URL:', url);

//   console.log('Final URL:', url);

//   const tokenRes = await (client as any).getAccessToken();
//   const accessToken = tokenRes?.token;
//   if (!accessToken) throw new Error('Failed to obtain access token');

//   // Build generation config (don't force responseMimeType here)
//   const generationConfig: Record<string, any> = {
//     temperature,
//     maxOutputTokens,
//     topP: 0.8,
//     topK: 40
//   };

//   const body = {
//     contents: [{ role: 'user', parts: [{ text: prompt }] }],
//     generationConfig
//   };

//   console.log('Request body config:', JSON.stringify(generationConfig, null, 2));

//   const resp = await fetch(url, {
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify(body),
//     // we allow a long timeout at function level; fetch will use default but cloud will allow full time
//   });

//   // Attempt to read body as text first (safer for unpredictable Vertex output)
//   const rawText = await resp.text().catch((e) => {
//     console.error('Failed to read response text:', e);
//     return '';
//   });

//   console.log('Response status:', resp.status);
//   console.log('Response headers:', Object.fromEntries(resp.headers.entries()));
//   console.log('Raw response text length:', rawText ? rawText.length : 0);
//   console.log('Raw response text (first 1000 chars):', rawText ? rawText.slice(0, 1000) : '[empty]');

//   if (!resp.ok) {
//     // include body snippet for easier debugging
//     throw new Error(`Vertex AI HTTP ${resp.status}: ${rawText ? rawText.slice(0, 1000) : '[empty body]'}`);
//   }

//   if (!rawText || rawText.trim().length === 0) {
//     throw new Error('Empty response body from Vertex AI');
//   }

//   // Try parsing outer JSON if the whole response is JSON
//   let parsedOuter: any = null;
//   try {
//     parsedOuter = JSON.parse(rawText);
//     console.log('Outer JSON parsed successfully');
//     console.log('Response structure keys:', Object.keys(parsedOuter));
//   } catch (e) {
//     console.warn('Outer response is not pure JSON; will attempt to extract candidate content from text.');
//   }

//   // If parsedOuter exists and has candidates, use that; otherwise try to extract JSON from model output text
//   let candidate: any = parsedOuter?.candidates?.[0] ?? null;
//   let rawContent: string | null = null;

// if (candidate) {
//   rawContent = extractContentFromCandidate(candidate);
//   console.log('Found candidate content via parsedOuter.');
// } else {
//   // Try to find a JSON blob inside the free-text rawText (models sometimes prepend explanation)
//   // Find the LAST {...} or [...] in the text - often the model outputs JSON at the end.
//   const jsonObjectMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/m);
//   if (jsonObjectMatch) {
//     rawContent = jsonObjectMatch[1] ?? null; // normalize undefined -> null
//     console.log('Extracted JSON blob from raw text (regex fallback).');
//   } else {
//     // fallback: attempt to locate "candidates" substring and parse nearby JSON
//     const candStart = rawText.indexOf('"candidates"');
//     if (candStart !== -1) {
//       try {
//         const sliceStart = Math.max(0, candStart - 50);
//         const partial = rawText.slice(sliceStart);
//         const j = JSON.parse(partial);
//         candidate = j.candidates?.[0] ?? null;
//         rawContent = extractContentFromCandidate(candidate);
//       } catch (e) {
//         console.warn('Failed to parse partial JSON around candidates key:', e);
//       }
//     }
//   }
// }

//   // As a last fallback, if rawContent is still null, try to parse rawText as JSON and pick heuristics
//   if (!rawContent && parsedOuter) {
//     try {
//       // try candidate-like shapes anywhere
//       if (Array.isArray(parsedOuter.candidates) && parsedOuter.candidates.length > 0) {
//         candidate = parsedOuter.candidates[0];
//         rawContent =
//           candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
//           candidate?.content?.parts?.[0]?.text ||
//           candidate?.content?.text ||
//           null;
//       } else if (parsedOuter.content) {
//         rawContent = parsedOuter.content?.text ?? JSON.stringify(parsedOuter.content);
//       }
//     } catch (e) {
//       console.warn('Fallback parsing from parsedOuter failed:', e);
//     }
//   }

//   if (!rawContent) {
//     // nothing usable found - throw with as much context as possible
//     console.error('No model candidate content extracted. Full rawText preview:', rawText.slice(0, 2000));
//     throw new Error('Model did not return content in expected format - see logs for raw response.');
//   }

//   let cleanContent = rawContent.trim();
//   // Remove triple backticks or surrounding code fences if present
//   if (cleanContent.startsWith('```')) {
//     cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
//     console.log('Removed code fences from model content.');
//   }

//   console.log('Clean content length:', cleanContent.length);
//   console.log('Clean content preview:', cleanContent.slice(0, 500));

//   if (expectJson) {
//     // If content looks like JSON or starts with { or [, try parse, otherwise try to extract JSON again
//     try {
//       const parsed = JSON.parse(cleanContent);
//       console.log('Inner JSON parsed successfully');
//       console.log('Parsed structure keys:', Object.keys(parsed));
//       console.log('=== VERTEX AI DEBUG END ===');
//       return parsed;
//     } catch (e) {
//       // Try to recover by finding the first opening { or [ and parsing from there until the last closing } or ]
//       const firstOpen = Math.max(cleanContent.indexOf('{'), cleanContent.indexOf('['));
//       const lastClose = Math.max(cleanContent.lastIndexOf('}'), cleanContent.lastIndexOf(']'));
//       if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
//         const candidateJson = cleanContent.slice(firstOpen, lastClose + 1);
//         try {
//           const parsed = JSON.parse(candidateJson);
//           console.log('Recovered inner JSON by slicing content.');
//           console.log('=== VERTEX AI DEBUG END ===');
//           return parsed;
//         } catch (e2) {
//           console.error('Failed to parse recovered JSON snippet:', e2);
//           console.error('Content that failed to parse:', candidateJson.slice(0, 1000));
//           throw new Error(`Model did not return valid JSON: ${e2}`);
//         }
//       } else {
//         console.error('No JSON object/array boundaries found in clean content. Content preview:', cleanContent.slice(0, 1000));
//         throw new Error('Model did not return valid JSON');
//       }
//     }
//   }

//   console.log('=== VERTEX AI DEBUG END ===');
//   return cleanContent;
// }


// /** De-identify text using DLP */
// async function dlpDeidentifyText(text: string, policy: 'redact'|'tokenize'|'encrypt' = 'redact') {
//   if (!text || text.trim().length === 0) return '';
  
//   try {
//     const parent = `projects/${DLP_PROJECT}/locations/global`;
//     const inspectConfig = {
//       infoTypes: [
//         { name: 'PERSON_NAME' }, { name: 'EMAIL_ADDRESS' }, { name: 'PHONE_NUMBER' },
//         { name: 'DATE_OF_BIRTH' }, { name: 'US_SOCIAL_SECURITY_NUMBER' }, { name: 'IP_ADDRESS' }
//       ],
//       includeQuote: false
//     };

//     let deidentifyConfig: any;
//     if (policy === 'redact') {
//       deidentifyConfig = {
//         infoTypeTransformations: {
//           transformations: [
//             { primitiveTransformation: { replaceWithInfoTypeConfig: {} } }
//           ]
//         }
//       };
//     } else if (policy === 'tokenize') {
//       if (!KMS_KEY_NAME) throw new Error('KMS_KEY_NAME env required for tokenize policy');
//       deidentifyConfig = {
//         infoTypeTransformations: {
//           transformations: [
//             {
//               primitiveTransformation: {
//                 cryptoDeterministicConfig: {
//                   cryptoKey: { kmsWrapped: { cryptoKeyName: KMS_KEY_NAME } },
//                   surrogateInfoType: { name: 'DEID_TOKEN' }
//                 }
//               }
//             }
//           ]
//         }
//       };
//     } else {
//       // fallback: character mask full matches
//       deidentifyConfig = {
//         infoTypeTransformations: {
//           transformations: [
//             { primitiveTransformation: { characterMaskConfig: { maskingCharacter: '*', numberToMask: 0 } } }
//           ]
//         }
//       };
//     }

//     const [resp] = await dlp.deidentifyContent({
//       parent,
//       inspectConfig,
//       deidentifyConfig,
//       item: { value: text }
//     });

//     return resp.item?.value ?? text;
//   } catch (error) {
//     console.warn('DLP de-identification failed, returning original text:', error);
//     return text; // Return original text if DLP fails
//   }
// }

// /** Insert analytics row to BigQuery test_cases_analytics */
// async function insertAnalyticsRow(row: any) {
//   try {
//     await bq.dataset(BQ_DATASET).table(BQ_TESTCASES_TABLE).insert(row);
//   } catch (error) {
//     console.warn('Analytics insert failed:', error);
//     // Don't throw - this is non-critical
//   }
// }

// function shortId(prefix = 'tc') {
//   return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
// }

// /** Validate test case structure */
// function validateTestCase(tc: any): boolean {
//   return tc && 
//          typeof tc.title === 'string' && tc.title.trim().length > 0 &&
//          typeof tc.description === 'string' && tc.description.trim().length > 0;
// }

// setGlobalOptions({
//   region: 'us-central1',
//   // maxInstances: 10,
// });

// export const generateTestCases = functions
//   .region('us-central1')
//   .runWith({
//     timeoutSeconds: 540,
//     memory: '2GB',
//   })
//   .https.onRequest(async (req, res) => {
//     // Add CORS headers
//     res.set('Access-Control-Allow-Origin', '*');
//     res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
//     res.set('Access-Control-Allow-Headers', 'Content-Type');
    
//     if (req.method === 'OPTIONS') {
//       res.status(204).send('');
//       return;
//     }

//     try {
//       console.log('Starting test case generation...');

//       const body = req.body as GenerateRequest;
//       if (!body || (!body.requirementId && !body.requirementText)) {
//         res.status(400).json({ error: 'Missing requirementId or requirementText' });
//         return;
//       }

//       // Resolve requirement text
//       let requirementText = body.requirementText;
//       let requirementIdForRecord: string | null = null;
//       if (body.requirementId) {
//         requirementIdForRecord = body.requirementId;
//         const reqDoc = await admin.firestore().collection('requirements').doc(body.requirementId).get();
//         if (!reqDoc.exists) {
//           res.status(404).json({ error: 'requirementId not found in Firestore' });
//           return;
//         }
//         const data = reqDoc.data() as any;
//         requirementText = requirementText ?? (data.description || data.text || '');
//       }

//       if (!requirementText || requirementText.trim().length === 0) {
//         res.status(400).json({ error: 'Empty requirement text' });
//         return;
//       }

//       const options = body.options ?? {};
//       const dlpPolicy = options.dlpPolicy ?? 'redact';

//       console.log('Requirement text length:', requirementText.length);
//       console.log('Options:', options);

//       // 1) Extract keywords & get candidate compliance rows from BQ
//       const keywords = extractKeywords(requirementText, 12);
//       console.log('Keywords extracted:', keywords);

//       const candidates = await queryComplianceCandidates(keywords, 200);
//       console.log('Compliance candidates found:', candidates.length);

//       // 2) Build prompt & call Vertex AI (Gemini)
//       const prompt = buildLLMPrompt(requirementText, candidates, options);
//       const rawModelOutput = await callVertexAI(prompt, 0.1, 2048, true);

//       // 3) Validate the response structure
//       if (!rawModelOutput || typeof rawModelOutput !== 'object') {
//         throw new Error('Invalid response format from model');
//       }

//       const testCases: any[] = rawModelOutput.testCases ?? [];
//       if (!Array.isArray(testCases) || testCases.length === 0) {
//         res.status(500).json({ 
//           error: 'Model returned no test cases',
//           debug: { 
//             hasTestCases: !!rawModelOutput.testCases,
//             responseKeys: Object.keys(rawModelOutput)
//           }
//         });
//         return;
//       }

//       // 4) Validate each test case
//       const validTestCases = testCases.filter(validateTestCase);
//       if (validTestCases.length === 0) {
//         res.status(500).json({ 
//           error: 'No valid test cases with required fields',
//           debug: { 
//             totalGenerated: testCases.length,
//             validCount: validTestCases.length
//           }
//         });
//         return;
//       }

//       console.log('Valid test cases generated:', validTestCases.length);

//       const saved: Array<{ id: string; mappedCompliance: any[] }> = [];

//       // 5) Process each valid test case
//       for (const tc of validTestCases) {
//         // ensure id
//         const tcId = (tc.id && String(tc.id)) || shortId('tc');
        
//         // sanitize fields and apply DLP de-identification
//         const combinedText = [
//           tc.title ?? '',
//           tc.description ?? '',
//           (tc.steps || []).join('\n'),
//           tc.expectedResults ?? '',
//           tc.preconditions ?? ''
//         ].join('\n\n');

//         const deidText = dlpPolicy !== 'none' 
//           ? await dlpDeidentifyText(combinedText, dlpPolicy)
//           : combinedText;

//         // Build Firestore doc
//         const doc: any = {
//           id: tcId,
//           requirementId: requirementIdForRecord,
//           title: tc.title ?? '',
//           description: tc.description ?? '',
//           preconditions: tc.preconditions ?? '',
//           steps: tc.steps ?? [],
//           expectedResults: tc.expectedResults ?? '',
//           postconditions: tc.postconditions ?? '',
//           classificationTags: tc.classificationTags ?? [],
//           aiConfidence: typeof tc.aiConfidence === 'number' ? tc.aiConfidence : (tc.aiConfidence ? Number(tc.aiConfidence) : 0.0),
//           suggestedCompliance: tc.suggestedCompliance ?? [],
//           generationMethod: 'GEMINI',
//           createdAt: admin.firestore.FieldValue.serverTimestamp(),
//           updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//           deidentifiedText: deidText
//         };

//         // write to Firestore
//         await admin.firestore().collection('testCases').doc(tcId).set(doc);

//         // Insert analytics row
//         const analyticsRow = {
//           test_case_id: tcId,
//           requirement_id: requirementIdForRecord,
//           ai_confidence_score: doc.aiConfidence,
//           generation_method: 'GEMINI',
//           compliance_mappings: (doc.suggestedCompliance || []).map((m: any) => ({
//             standard_id: m.standard_id,
//             requirement_ids: m.requirement_id ? [m.requirement_id] : [],
//             coverage_percentage: (m.matchConfidence ? Number(m.matchConfidence) * 100 : 0)
//           })),
//           classification_tags: doc.classificationTags,
//           priority: tc.priority ?? null,
//           generated_at: new Date().toISOString(),
//           reviewed_at: null,
//           reviewer_id: null,
//           approval_status: 'PENDING_REVIEW',
//           evidence_generated: false,
//           jira_synced: false
//         };

//         await insertAnalyticsRow(analyticsRow);
//         saved.push({ id: tcId, mappedCompliance: doc.suggestedCompliance });
//       }

//       console.log('Successfully saved', saved.length, 'test cases');
//       res.json({ success: true, created: saved });

//     } catch (err: any) {
//       console.error('generateTestCases error:', err);
//       res.status(500).json({ 
//         error: err?.message ?? String(err),
//         stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
//       });
//     }
//   });