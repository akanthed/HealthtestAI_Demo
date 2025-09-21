// To prevent reinitialization in hot-reload environments
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

/**
 * Initialization strategy (in order):
 * 1. `FIREBASE_SERVICE_ACCOUNT_JSON` env var containing the service account JSON string.
 * 2. `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to a service account JSON file.
 * 3. `admin.credential.applicationDefault()` (ADC).
 * 4. Fallback to `admin.initializeApp()` (may work in some hosted environments).
 */
if (!admin.apps.length) {
  let initialized = false;

  // small helpers to safely access credential helpers because in some
  // bundler/runtime combinations `admin.credential` may be undefined
  // which causes a TypeError when attempting to read nested properties
  // (observed as: Cannot read properties of undefined (reading 'INTERNAL')).
  function safeCert(parsed: any) {
    try {
      // check existence before calling
      if (admin && (admin as any).credential && typeof (admin as any).credential.cert === 'function') {
        return (admin as any).credential.cert(parsed as admin.ServiceAccount);
      }
    } catch (e) {
      console.warn('safeCert: admin.credential.cert threw:', e);
    }
    return undefined;
  }

  function safeApplicationDefault() {
    try {
      if (admin && (admin as any).credential && typeof (admin as any).credential.applicationDefault === 'function') {
        return (admin as any).credential.applicationDefault();
      }
    } catch (e) {
      console.warn('safeApplicationDefault: admin.credential.applicationDefault threw:', e);
    }
    return undefined;
  }

  // 1) FIREBASE_SERVICE_ACCOUNT_JSON
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    try {
      const parsed = JSON.parse(svcJson);
      const projectIdFromEnv = process.env.PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;
      const projectId = (parsed && (parsed.project_id || parsed.projectId)) || projectIdFromEnv;
      const certCred = safeCert(parsed);
      const initOpts: Record<string, any> = {};
      if (certCred) initOpts.credential = certCred;
      if (projectId) initOpts.projectId = projectId;
      admin.initializeApp(initOpts);
      console.log('firebase-admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      initialized = true;
    } catch (e) {
      console.error('Failed to initialize firebase-admin from FIREBASE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  // 2) GOOGLE_APPLICATION_CREDENTIALS file path
  if (!initialized && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      const raw = fs.readFileSync(credPath, 'utf8');
      const parsed = JSON.parse(raw);
      const projectIdFromEnv = process.env.PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;
      const projectId = (parsed && (parsed.project_id || parsed.projectId)) || projectIdFromEnv;
      const certCred = safeCert(parsed);
      const initOpts: Record<string, any> = {};
      if (certCred) initOpts.credential = certCred;
      if (projectId) initOpts.projectId = projectId;
      admin.initializeApp(initOpts);
      console.log('firebase-admin initialized from GOOGLE_APPLICATION_CREDENTIALS file:', credPath, 'usedCredential:', !!certCred);
      initialized = true;
    } catch (e) {
      console.error('Failed to initialize firebase-admin from GOOGLE_APPLICATION_CREDENTIALS path:', e);
    }
  }

  // 3) Application Default Credentials
  if (!initialized) {
    try {
      const projectIdFromEnv = process.env.PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;
      const adc = safeApplicationDefault();
      const initOpts: Record<string, any> = {};
      if (adc) initOpts.credential = adc;
      if (projectIdFromEnv) initOpts.projectId = projectIdFromEnv;
      admin.initializeApp(initOpts);
      console.log('firebase-admin initialized with applicationDefault(), usedCredential:', !!adc);
      initialized = true;
    } catch (e) {
      console.warn('applicationDefault() failed for firebase-admin:', e);
    }
  }

  // 4) Fallback - plain initializeApp()
  if (!initialized) {
    try {
      const projectIdFromEnv = process.env.PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;
      admin.initializeApp({ ...(projectIdFromEnv ? { projectId: projectIdFromEnv } : {}) });
      console.log('firebase-admin initialized with default initializeApp() fallback');
      initialized = true;
    } catch (e) {
      console.error('Failed to initialize firebase-admin (all strategies):', e);
    }
  }
}

export { admin };

// Runtime sanity check: attempt a lightweight Firestore read to validate
// the initialized credentials have Firestore access. This runs once at module
// import time and only logs details — code should still allow callers to
// handle permission errors gracefully.
try {
  if (admin && (admin as any).firestore && typeof (admin as any).firestore === 'function') {
    const db = (admin as any).firestore();
    // read a doc that likely doesn't exist; if permissions are missing this will throw.
    // Use a non-reserved collection name for the lightweight permission check.
    // Note: collection ids that start and end with double underscores are reserved
    // and will trigger INVALID_ARGUMENT errors on reads; avoid those names here.
    db.doc('init_check/ping').get().then((snap: any) => {
      if (!snap.exists) {
        console.log('firebase-admin Firestore permission check: ok (read succeeded, doc not found)');
      } else {
        console.log('firebase-admin Firestore permission check: ok (doc exists)');
      }
    }).catch((e: any) => {
      console.warn('firebase-admin Firestore permission check failed. This usually means the service account or ADC used by firebase-admin lacks Firestore permissions or the read failed. Error:', e && e.message ? e.message : e);
      console.warn('If running locally set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with Firestore and Storage roles, e.g. roles/datastore.user and roles/storage.objectAdmin.');
    });
  }
} catch (e) {
  console.warn('Error during firebase-admin Firestore permission check:', e);
}
