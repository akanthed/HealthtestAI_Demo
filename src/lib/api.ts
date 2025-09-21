// Client-side API helpers
import { getAuth } from 'firebase/auth';
import { app, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Use internal Next.js proxy to avoid CORS; the server will forward to the external function.
const PROXY_PATH = '/api/generateTestcases';

export async function generateTestCases(requirement: string, testTypes?: string[], requirementId?: string) {
  if (!requirement || !requirement.trim()) {
    throw new Error('requirement text is required');
  }

  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to generate test cases');
  }

  const idToken = await user.getIdToken();

  const resp = await fetch(PROXY_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requirementText: requirement, test_types: testTypes ?? [], requirementId: requirementId ?? undefined }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Generation API error: ${resp.status} ${body}`);
  }

  const payload = await resp.json();

  // The proxy now performs server-side persistence using the Admin SDK.
  // The proxy will include `_persistedIds` in its JSON response when it saved
  // documents server-side. We avoid client-side writes to prevent permission
  // errors caused by Firestore security rules.
  try {
    if (payload && Array.isArray(payload._persistedIds)) {
      console.log(`Server persisted ${payload._persistedIds.length} generated test cases:`, payload._persistedIds);
    }
  } catch (err) {
    console.warn('Error while reading persisted ids from proxy response:', err);
  }

  return payload;
}

export default generateTestCases;
