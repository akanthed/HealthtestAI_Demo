// functions/src/bigqueryClient.ts
import { BigQuery } from '@google-cloud/bigquery';
const project = process.env.PROJECT_ID!;
const dataset = process.env.BQ_DATASET!;
const table = process.env.BQ_COMPLIANCE_TABLE!; // compliance_standards
export const bq = new BigQuery({ projectId: project });

export async function retrieveTopClauses(embedding: number[], topK = 5) {
  // This SQL computes cosine similarity between stored embedding and provided embedding param @embed
  const sql = `
    SELECT standard_id, clause_id, clause_text, evidence_needed, keywords, embedding,
      ( (SELECT SUM(a*b) FROM UNNEST(embedding) a WITH OFFSET i JOIN UNNEST(@embed) b WITH OFFSET j ON i=j) ) /
      (SQRT((SELECT SUM(x*x) FROM UNNEST(embedding) x)) * SQRT((SELECT SUM(y*y) FROM UNNEST(@embed) y))) AS cosine_sim
    FROM \`${project}.${dataset}.${table}\`
    ORDER BY cosine_sim DESC
    LIMIT @limit;
  `;
  const options = { query: sql, params: { embed: embedding, limit: topK }, location: 'US' };
  const [job] = await bq.createQueryJob(options);
  const [rows] = await job.getQueryResults();
  return rows;
}
