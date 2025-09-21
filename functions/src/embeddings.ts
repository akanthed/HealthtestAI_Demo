// functions/src/embeddings.ts (instrumented)
import { GoogleAuth } from 'google-auth-library';

const PROJECT = process.env.PROJECT_ID || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || '';
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const EMBEDDING_MODEL = process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-005';

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = tokenRes?.token;
  if (!token) throw new Error('Unable to obtain access token for Vertex AI');
  return token;
}

export async function createEmbedding(text: string): Promise<number[]> {
  if (!text) return [];
  const token = await getAccessToken();
  console.log('[embeddings] got access token length:', token.length);

  let model = EMBEDDING_MODEL;
  let url = '';
  if (model.includes('/projects/') || model.includes('/models/')) {
    url = `https://${LOCATION}-aiplatform.googleapis.com/v1/${model}:predict`;
  } else {
    url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/models/${encodeURIComponent(model)}:predict`;
  }

  console.log('[embeddings] URL:', url);
  const body = { instances: [{ content: text }] };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const status = resp.status;
  const contentType = resp.headers.get('content-type') || '';
  const raw = await resp.text();

  console.log('[embeddings] status:', status, 'content-type:', contentType, 'body-length:', raw.length);
  if (raw.length > 0 && contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw);
      const emb =
        parsed?.predictions?.[0]?.embedding ?? parsed?.predictions?.[0]?.denseVector ?? parsed?.predictions?.[0]?.vector;
      if (!emb || !Array.isArray(emb)) {
        throw new Error(`Unexpected embedding shape: ${JSON.stringify(parsed).slice(0, 1000)}`);
      }
      return emb.map((v: any) => Number(v));
    } catch (e) {
      throw new Error(`Failed to parse embedding JSON: ${e} -- raw: ${raw.slice(0,1000)}`);
    }
  }

  // helpful error message with raw body
  throw new Error(`Vertex embedding response not JSON or empty. status=${status} contentType=${contentType} body=${raw.slice(0,2000)}`);
}
