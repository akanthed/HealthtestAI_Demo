// functions/src/vertexClient.ts
import { GoogleAuth } from 'google-auth-library';

const PROJECT = process.env.PROJECT_ID!;
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const GEN_MODEL = process.env.VERTEX_MODEL!; // e.g. "models/text-bison@001" or full resource
const EMB_MODEL = process.env.VERTEX_EMBEDDING_MODEL || 'textembedding-gecko@001';

async function getAccessToken() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tok = await client.getAccessToken();
  if (!tok?.token) throw new Error('No access token');
  return tok.token;
}

// create embedding
export async function createEmbedding(text: string) {
  const token = await getAccessToken();
  const model = EMB_MODEL; // ensure region availability
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/models/${encodeURIComponent(model)}:predict`;
  const body = { instances: [{ content: text }] };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  // adjust for your embedding model output shape:
  return json.predictions?.[0]?.embedding ?? json.predictions?.[0]?.denseVector ?? null;
}

// call generative model and return raw string
export async function callGenerativeModel(prompt: string, params = { temperature: 0.1, maxOutputTokens: 1200 }) {
  const token = await getAccessToken();
  const model = GEN_MODEL; // short name or full path
  // Build robust URL: if GEN_MODEL includes 'projects/' use as-is, else construct with project/locations/models/<model>
  let url = '';
  if (model.includes('/projects/') || model.includes('/models/')) {
    url = `https://${LOCATION}-aiplatform.googleapis.com/v1/${model}:predict`;
  } else {
    url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/models/${encodeURIComponent(model)}:predict`;
  }
  const body = { instances: [{ content: prompt }], parameters: params };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  // return raw string — caller will JSON.parse or inspect
  return text;
}
