# HealthTestAI - AI-Powered Healthcare Test Case Generation

This is a full-stack application built with Next.js, Firebase, and Genkit that helps you generate, manage, and review software quality assurance test cases for the healthcare industry.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **AI/Generative**: [Genkit](https://firebase.google.com/docs/genkit)
- **Backend**: Firebase (no Cloud Functions)
- **Database**: [Firestore](https://firebase.google.com/docs/firestore) & [BigQuery](https://cloud.google.com/bigquery)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth)

## How to Run It Locally

Follow these steps to set up and run the project on your local machine for development and testing.

### 1. Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [Firebase CLI](https://firebase.google.com/docs/cli#install_the_firebase_cli)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

You will also need a Firebase project with the following enabled:
- **Authentication**: To handle user sign-in.
- **Firestore**: To store application data.

- **BigQuery**: For analytics and compliance data.
- **Vertex AI**: For the generative AI capabilities.

### 2. Project Setup

**A. Clone the Repository**
```bash
# Clone your project from your repository
git clone <your-repository-url>
cd <your-project-directory>
```

### 3. Environment Variables

This project uses environment variables to connect to Firebase and other Google Cloud services.

**A. Frontend Environment (`.env`)**
Create a `.env` file in the root of the project and add your Firebase project's configuration. You can get this from the Firebase console in `Project settings > Your apps > Firebase SDK snippet > Config`.

```
# .env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# This points the frontend to your locally running Genkit flows
GENERATE_TESTCASES_URL=http://localhost:3400/generateTestCases
```

**B. Authenticate with Google Cloud**
To allow your local backend to access Google Cloud services like Vertex AI and BigQuery, you need to authenticate.

```bash
gcloud auth application-default login
```

### 4. Running the Application

You need to run two processes in separate terminal windows: one for the Next.js frontend and one for the Genkit backend.

**A. Start the Backend (Genkit)**
In your first terminal, run the following command to start the Genkit development server. This will make your AI flows available locally.

```bash
npm run genkit:dev
```
This will typically start the service on `http://localhost:3400`.

**B. Start the Frontend (Next.js)**
In your second terminal, run the following command to start the Next.js development server.

```bash
npm run dev
```
Your application should now be running and accessible at `http://localhost:9002`.

### 5. Application Usage

- Open your browser to `http://localhost:9002` to see the login screen.
- The "Generate with AI" features should now work by calling your local Genkit backend.
- Data will be read from and written to your actual Firebase project's Firestore and BigQuery databases.

### 6. Deploying to Vercel

You can deploy the Next.js (App Router) frontend to Vercel while continuing to use Firebase/Google Cloud for backend services (Firestore, Auth, BigQuery, Vertex AI).

#### A. One-Time Vercel Setup
1. Create (or log into) a Vercel account.
2. Import your GitHub repository into Vercel.
3. In Project Settings > Framework Preset ensure "Next.js" is detected (it should auto-detect `next@15`).
4. Set the root directory to the repo root (where `package.json` and `next.config.ts` live).

#### B. Required Environment Variables (Vercel Project Settings > Environment Variables)
Set these for each environment (Preview, Production) as needed:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
# Optional / backend-assist vars if server components need them:
PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_APPLICATION_CREDENTIALS=NOT_USED_ON_VERCEL
```
Notes:
- Prefer using `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified JSON) only if absolutely necessary in server components / route handlers. Avoid exposing privileged keys to the browser — only `NEXT_PUBLIC_*` vars are exposed client-side.
- Do NOT set `GOOGLE_APPLICATION_CREDENTIALS` path on Vercel (no filesystem credential JSON). Instead embed minimal service account JSON in an env variable if needed server-side.

#### C. Genkit / AI Flow Calls in Production
If the Genkit flows currently run only via `npm run genkit:dev` locally, you have two options:
1. Keep AI generation behind a cloud endpoint. Deploy those separately and point the frontend to their HTTPS endpoint via a new env var (e.g. `GENERATE_TESTCASES_URL=https://<your-cloud-endpoint>/generateTestCases`).
2. (Advanced) Bundle flows directly inside the Next.js server runtime using `@genkit-ai/next`. Ensure any Vertex AI access happens server-side only.

Add whichever endpoint you choose as: `GENERATE_TESTCASES_URL=https://...` (if the frontend expects it). If the code currently hardcodes localhost, refactor to read from `process.env.GENERATE_TESTCASES_URL`.

#### D. Build & Output
Vercel uses `npm install` then `npm run build` automatically. The generated `.next` directory is served via the Vercel platform. The provided `vercel.json` supplies runtime config.

#### E. Firebase Auth Domain
Ensure the Vercel Production domain (e.g. `your-app.vercel.app` and any custom domain) is added to Firebase Console > Authentication > Settings > Authorized domains.

#### F. Firestore / BigQuery / Vertex AI Access From Vercel
Because Vercel serverless does not have default GCP credentials, you must:
- Use a service account JSON (least privilege) placed in `FIREBASE_SERVICE_ACCOUNT_JSON` env var.
- In server code, parse it and initialize admin SDK / Google clients explicitly.
- Limit scopes (roles) to only what is required (Firestore, BigQuery read/write, Vertex AI invocation).

#### G. Protecting Sensitive Variables
Only prefix variables with `NEXT_PUBLIC_` if they must be accessible in the browser. Service account JSON and project IDs that are only used server-side must remain unprefixed.

#### H. Deployment Steps Summary
1. Push changes to GitHub main (or designated branch).
2. Vercel builds automatically; check Build Logs.
3. Verify environment variables present for the deployment (Vercel UI shows warnings if missing).
4. Open the preview URL; test auth & data access.
5. Promote to Production (merge to main or use Promote button).

#### I. Observability / Debugging
- Use Vercel Logs (Serverless / Edge) for route handler and server component issues.
- For Firestore / BigQuery ops, also monitor GCP logs & quotas.
- If encountering credential errors, log whether `FIREBASE_SERVICE_ACCOUNT_JSON` is present (never log the entire JSON!).

#### J. Future Hardening (Optional)
- Add a build-time type check gate (remove `ignoreBuildErrors`).
- Add Rate limiting for AI generation endpoints.
- Implement structured logging (e.g. pino) in server routes.
- Use secret rotation for service accounts.

### 7. Cleaning Up / Local vs Cloud Differences
- Local uses ADC (`gcloud auth application-default login`).
- Vercel uses explicit JSON credential injection.
- Ensure you do not commit credential files; rely on env vars.

### 8. Security: Service Account Key Handling
A service account JSON (`health_test_ai.json`) was previously present and is now removed. Treat any exposed private key as compromised.

Recommended actions (one time):
1. In Google Cloud Console > IAM & Admin > Service Accounts, select the service account and delete the leaked key (matching the `private_key_id`).
2. Create a new key ONLY if required. Prefer Workload Identity Federation or Firebase-managed credentials where possible.
3. If a new key is unavoidable, do NOT commit the JSON file. Instead set `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel (and locally in `.env.local`) to the entire JSON compressed into a single line (escape newlines) or use a base64 form you decode at runtime.
4. Purge the key from git history (see below) if the repository was ever pushed while containing the key.

Git history purge (example):
```
# Ensure you have a clean working tree first
git filter-repo --path health_test_ai.json --invert-paths
# Or using BFG Repo-Cleaner
# java -jar bfg.jar --delete-files health_test_ai.json

git push --force --tags origin main
```
Notify collaborators to reclone after force push.

Runtime initialization pattern (example):
```ts
// firebase-admin bootstrap snippet
const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!admin.apps.length && svcRaw) {
  const creds = JSON.parse(svcRaw);
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: creds.project_id,
      clientEmail: creds.client_email,
      privateKey: creds.private_key,
    }),
  });
}
```
Avoid using `GOOGLE_APPLICATION_CREDENTIALS` with a path on Vercel—there is no file. Use the JSON env var instead.

---
If you need an automated script to sync env vars to Vercel (`vercel env pull` / `vercel env add`), that can be added later.