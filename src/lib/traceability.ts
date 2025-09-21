import { admin } from '@/lib/firebase-admin';

export type UploadedArtifact = {
  storagePath: string;
  signedUrl?: string;
  checksum?: string;
};

export async function uploadJsonSnapshot(bucketName: string, key: string, obj: any, signedUrlExpiresSeconds = 3600): Promise<UploadedArtifact> {
  if (!bucketName) throw new Error('Missing bucketName');
  const storage = admin.storage();
  const bucket = storage.bucket(bucketName);
  const json = JSON.stringify(obj, null, 2);
  const file = bucket.file(key);
  await file.save(json, { contentType: 'application/json' });
  // compute checksum
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  try {
    await file.setMetadata({ metadata: { sha256: hash } });
  } catch (e) {
    // ignore
  }
  const expires = Date.now() + signedUrlExpiresSeconds * 1000;
  const [url] = await file.getSignedUrl({ action: 'read', expires });
  return { storagePath: key, signedUrl: url, checksum: hash };
}

export async function uploadBuffer(bucketName: string, key: string, buffer: Buffer | Uint8Array, contentType = 'application/octet-stream', signedUrlExpiresSeconds = 3600): Promise<UploadedArtifact> {
  if (!bucketName) throw new Error('Missing bucketName');
  const storage = admin.storage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(key);
  await file.save(buffer, { contentType });
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  try {
    await file.setMetadata({ metadata: { sha256: hash } });
  } catch (e) {}
  const expires = Date.now() + signedUrlExpiresSeconds * 1000;
  const [url] = await file.getSignedUrl({ action: 'read', expires });
  return { storagePath: key, signedUrl: url, checksum: hash };
}

export function storagePathForInvocation(invocationId: string, fileName: string) {
  return `evidence-packs/${invocationId}/${fileName}`;
}

// Backwards-compatible helper: can be called as storagePathForTestCase(invocationId, testCaseId)
// or as storagePathForTestCase(testCaseId) when there is no invocation context.
export function storagePathForTestCase(invocationIdOrTestCaseId: string, maybeTestCaseId?: string) {
  if (typeof maybeTestCaseId === 'string' && maybeTestCaseId.length > 0) {
    const invocationId = invocationIdOrTestCaseId;
    const testCaseId = maybeTestCaseId;
    return `evidence-packs/${invocationId}/testcases/${testCaseId}.json`;
  }
  // single-arg form: treat the provided value as the testCaseId and place it in a shared testcases folder
  const testCaseId = invocationIdOrTestCaseId;
  return `evidence-packs/testcases/${testCaseId}.json`;
}

export default {
  uploadJsonSnapshot,
  uploadBuffer,
  storagePathForInvocation,
  storagePathForTestCase,
};
