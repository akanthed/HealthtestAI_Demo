# Vercel Integration & Backend Services

This document clarifies how the deployed Vercel frontend interacts with existing Firebase Cloud Functions, Firestore, BigQuery, Vertex AI, and the Cloud Run PDF worker.

## Overview
The Vercel deployment serves only the Next.js UI (and any server components / route handlers). Heavy data + AI tasks remain in Google Cloud to leverage existing IAM, networking, and scalability.

## Components
- Frontend: Next.js (App Router) on Vercel.
- Authentication: Firebase Auth (client SDK in browser). Vercel domain must be authorized in Firebase Console.
- Firestore / BigQuery: Accessed via Firebase Admin SDK / Google clients inside Next.js server functions OR (preferred) via existing Cloud Functions endpoints.
- Vertex AI: Invoked by Cloud Functions or by Next.js server runtime using service account JSON provided in env var.
- Cloud Run (pdf-worker): Generates PDFs asynchronously; frontend polls Firestore / Storage for results.

## Recommended Interaction Pattern
1. Browser authenticates with Firebase (client SDK) obtaining ID token.
2. For protected server actions, send ID token in `Authorization: Bearer <token>` header to a Cloud Function / Cloud Run endpoint (not directly to Vercel unless implemented server-side).
3. Backend verifies token (Admin SDK) and performs Firestore/BigQuery/Vertex AI operations.
4. Frontend receives structured JSON response.

## Service Account Strategy
- Do not embed high-privilege keys in public env vars.
- Use a minimally-scoped service account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON` for server-side needs only.
- Prefer calling pre-existing Cloud Functions that already run with Firebase-managed service credentials.

## Environment Variables Recap
```
NEXT_PUBLIC_FIREBASE_*
PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
GENERATE_TESTCASES_URL (if Cloud Function / Run endpoint)
```

## Local vs Vercel Differences
| Concern | Local | Vercel |
|---------|-------|--------|
| Credentials | ADC via gcloud | JSON via env var |
| Genkit flows | `genkit:dev` process | Cloud Function / integrated server route |
| PDF worker | Local (optional) or Cloud Run | Cloud Run |

## Deployment Order Suggestion
1. Deploy / verify Firebase (Firestore rules, Functions) & Cloud Run worker.
2. Confirm endpoints working with curl / Postman.
3. Deploy Vercel frontend pointing to those endpoints.
4. Add domains to Firebase Auth allowlist.
5. Smoke test user flows.

## Logs & Debugging
- Vercel: Check function logs for SSR/route issues.
- Firebase Functions: `firebase functions:log` or Cloud Logging.
- Cloud Run: Cloud Logging (filter by service name).

## Future Enhancements
- Add an API gateway layer (e.g., Cloud Endpoints / API Gateway) for consistent auth & quota.
- Introduce tracing (OpenTelemetry) propagated via headers from Vercel to GCP services.
- Implement circuit breakers / retries for cross-cloud calls.

---
Keep this file updated as architecture evolves.
