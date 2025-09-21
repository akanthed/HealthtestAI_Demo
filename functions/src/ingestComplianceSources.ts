// functions/src/ingestComplianceSources.ts
import { BigQuery } from '@google-cloud/bigquery';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import pdfParse from 'pdf-parse';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { admin } from './firebaseApp';
import { createEmbedding } from './embeddings';


type SourceSpec = {
  url: string;
  standard_id?: string;
  standard_name?: string;
  standard_version?: string;
  jurisdiction?: string;
  category?: string;
};

const DEFAULT_SOURCES: SourceSpec[] = [
  {
    url: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
    standard_id: 'HIPAA_SECURITY',
    standard_name: 'HIPAA Security Rule',
    jurisdiction: 'US',
    category: 'Healthcare Privacy & Security'
  },
  {
    url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
    standard_id: 'GDPR',
    standard_name: 'GDPR',
    jurisdiction: 'EU',
    category: 'Data Protection'
  },
  {
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
    standard_id: 'FDA_21CFR820',
    standard_name: 'FDA 21 CFR Part 820',
    jurisdiction: 'US',
    category: 'Medical Device Quality'
  }
];

// ensure project env is set
const projectIdEnv = process.env.PROJECT_ID || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
if (!projectIdEnv) {
  throw new Error('Missing PROJECT_ID / GCP_PROJECT / GCLOUD_PROJECT env var');
}
const projectId: string = String(projectIdEnv);

const BQ_DATASET = process.env.BQ_DATASET ;
const BQ_COMPLIANCE_TABLE = process.env.BQ_COMPLIANCE_TABLE ;
const BQ_AUDIT_TABLE = process.env.BQ_AUDIT_TABLE || 'audit_trail';

const bq = new BigQuery({ projectId });

/** Simple keyword extractor — returns top N words */
function extractKeywords(text: string, limit = 10): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['which','that','where','while','these','those','under','over','have','with','from','between'].includes(w));
  const freq: Record<string, number> = {};
  for (const w of cleaned) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map((p) => p[0]);
}

/** Split HTML into sections using headings or paragraphs */
function splitIntoSectionsHtml($: CheerioAPI): { id?: string; title?: string; text: string }[] {
  const out: { id?: string; title?: string; text: string }[] = [];
  const headings = $('h1,h2,h3,h4').toArray();

  if (headings.length > 0) {
    headings.forEach((hd: any) => {
      const $hd = $(hd);
      const title = $hd.text().trim();
      let node: Node | null = (hd as any).nextSibling ?? null;
      let buffer = '';
      while (node) {
        // stop when we hit the next heading
        if ((node as any).type === 'tag' && (node as any).tagName && /^h[1-4]$/i.test((node as any).tagName)) break;
        try {
          // wrap node with $ to safely get text for element/text nodes
          buffer += $(node as any).text ? $(node as any).text() : '';
        } catch {
          buffer += '';
        }
        node = (node as any).nextSibling ?? null;
      }
      const text = buffer.trim();
      if (title && title.length > 0) {
        out.push({ title, text });
      } else if (text && text.length > 0) {
        out.push({ text });
      }
    });
    return out;
  }

  // fallback to paragraphs
  $('p').each((i: number, el: any) => {
    try {
      const txt = $(el).text().trim();
      if (txt.length > 30) out.push({ text: txt });
    } catch {
      // ignore parse errors
    }
  });
  return out;
}

/** Split plaintext (PDF text) into sections heuristically */
function splitIntoSectionsText(txt: string): { id?: string; title?: string; text: string }[] {
  const paras = txt.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: { id?: string; title?: string; text: string }[] = [];
  for (const p of paras) {
  // Use [\s\S] instead of dot with /s (dotAll) for broader TS target compatibility
  const m = p.match(/^([A-Za-z0-9.\-]{1,20})\s*[:\-]?\s*([\s\S]+)/);
    if (m && m[1] && m[2]) {
      out.push({ id: String(m[1]), text: String(m[2]).slice(0, 1500) });
    } else {
      out.push({ text: p.slice(0, 1500) });
    }
  }
  return out;
}

/** Fetch URL and parse into clause-like sections */
async function parseUrlToSections(source: SourceSpec): Promise<Array<Record<string, any>>> {
  const url = source.url;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);

  const contentType = String(resp.headers.get('content-type') || '');
  let sections: { id?: string; title?: string; text: string }[] = [];

  if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
    const buffer = await resp.buffer();
    const data = await pdfParse(buffer as Buffer);
    sections = splitIntoSectionsText(String(data.text || ''));
  } else {
    const html = await resp.text();
    const $ = cheerio.load(html);
    sections = splitIntoSectionsHtml($);
    if (sections.length === 0) {
      const bodyText = $('body').text();
      sections = splitIntoSectionsText(String(bodyText || ''));
    }
  }

  const rows: Record<string, any>[] = [];
  for (const s of sections) {
    const requirement_id = s.id ?? null;
    const requirement_text = (s.title && s.title.length > 0) ? s.title : s.text.slice(0, 400);
    const raw_text = s.text.slice(0, 20000);
    const keywords = extractKeywords(requirement_text + ' ' + raw_text, 12);
    rows.push({
      standard_id: source.standard_id ?? null,
      standard_name: source.standard_name ?? null,
      standard_version: source.standard_version ?? null,
      jurisdiction: source.jurisdiction ?? null,
      category: source.category ?? null,
      source_url: url,
      requirement_id,
      requirement_text,
      raw_text,
      evidence_needed: [] as string[],
      testing_guidance: null,
      keywords
    });
  }

  return rows;
}

/** Upsert clause row into BigQuery using MERGE */
async function upsertComplianceRow(row: Record<string, any>) {
  const tableId = `${projectId}.${BQ_DATASET}.${BQ_COMPLIANCE_TABLE}`;

  const mergeSql = `
    MERGE \`${tableId}\` T
    USING (SELECT
      @standard_id AS standard_id,
      @standard_name AS standard_name,
      @standard_version AS standard_version,
      @jurisdiction AS jurisdiction,
      @category AS category,
      @source_url AS source_url,
      @raw_text AS raw_text,
      @requirement_id AS requirement_id,
      @requirement_text AS requirement_text,
      @evidence_needed AS evidence_needed,
      @testing_guidance AS testing_guidance,
      @keywords AS keywords,
      @embedding AS embedding
    ) S
    ON T.standard_id = S.standard_id AND IFNULL(T.requirement_id, '') = IFNULL(S.requirement_id, '')
    WHEN MATCHED THEN
      UPDATE SET
        requirement_text = S.requirement_text,
        raw_text = S.raw_text,
        keywords = S.keywords,
        testing_guidance = COALESCE(S.testing_guidance, T.testing_guidance),
        embedding = S.embedding,
        last_updated = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (standard_id, standard_name, standard_version, jurisdiction, category, source_url, raw_text, requirement_id, requirement_text, evidence_needed, testing_guidance, keywords, embedding)
      VALUES (S.standard_id, S.standard_name, S.standard_version, S.jurisdiction, S.category, S.source_url, S.raw_text, S.requirement_id, S.requirement_text, S.evidence_needed, S.testing_guidance, S.keywords, S.embedding)
  `;

  const params: any = {
    standard_id: row.standard_id ?? null,
    standard_name: row.standard_name ?? null,
    standard_version: row.standard_version ?? null,
    jurisdiction: row.jurisdiction ?? null,
    category: row.category ?? null,
    source_url: row.source_url ?? null,
    raw_text: row.raw_text ?? null,
    requirement_id: row.requirement_id ?? null,
    requirement_text: row.requirement_text ?? null,
    evidence_needed: row.evidence_needed ?? [],
    testing_guidance: row.testing_guidance ?? null,
    keywords: row.keywords ?? [],
    embedding: row.embedding ?? []   // <<-- pass embedding array here
  };

  await bq.query({
    query: mergeSql,
    params,
    location: 'US'
  });
}

/** Write a simple audit row into BigQuery audit_trail */
async function writeAuditRecord(action: string, details: Record<string, any>) {
  const row = {
    event_id: `ingest-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    user_id: 'system_ingest',
    user_email: null,
    action_type: action,
    resource_type: 'compliance_standards',
    resource_id: details.source_url ?? null,
    before_value: null,
    after_value: details,
    ip_address: null,
    user_agent: null,
    session_id: null,
    timestamp: new Date().toISOString(),
    metadata: null
  };

  await bq.dataset(BQ_DATASET).table(BQ_AUDIT_TABLE).insert(row);
}

/**
 * HTTP function entrypoint
 * Accepts optional JSON { sourceUrls: [{url, standard_id, ...}, ...] }
 */
setGlobalOptions({
  region: 'us-central1',
  // maxInstances: 10,
});

export const ingestComplianceSources = onRequest(
  {
    cpu: 2,
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (req, res) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.status(405).send('Only POST or GET allowed');
      return;
    }

    let sources: SourceSpec[] = DEFAULT_SOURCES.slice();
    if (process.env.DEFAULT_SOURCES) {
      try {
        const envList = String(process.env.DEFAULT_SOURCES).split(',').map((u) => u.trim()).filter(Boolean);
        envList.forEach((u) => sources.push({ url: u }));
      } catch { /* ignore malformed env */ }
    }

    if (req.body && Array.isArray(req.body.sourceUrls)) {
      const provided = req.body.sourceUrls as SourceSpec[];
      sources = provided.concat(sources);
    }

    const summary: { url: string; inserted: number; updated: number; error?: string }[] = [];

    for (const src of sources) {
      try {
        const rows = await parseUrlToSections(src);
        let inserted = 0;
        let updated = 0;
        for (const r of rows) {
          // Add embedding creation and insertion here
          const embedding = await createEmbedding(r.raw_text || r.requirement_text);
          const rowWithEmbedding = { ...r, embedding };
          await upsertComplianceRow(rowWithEmbedding);
          inserted++;
        }
        summary.push({ url: src.url, inserted, updated });
        await writeAuditRecord('ingest_compliance_source', { source_url: src.url, row_count: rows.length });
      } catch (err: any) {
        console.error('Error processing', src.url, err);
        summary.push({ url: src.url, inserted: 0, updated: 0, error: String(err?.message || err) });
      }
    }

    res.json({ success: true, summary });
  } catch (err: any) {
    console.error('ingestComplianceSources error', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
