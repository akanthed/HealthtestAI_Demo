# generateEvidencePack usage

This file shows quick examples for calling the `generateEvidencePack` Genkit flow and the environment variables required to upload the generated report to Cloud Storage.

## Environment

- `TRACEABILITY_BUCKET` - (optional) GCS bucket name where evidence pack reports will be uploaded. Example: `my-project-traceability`
- `TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS` - (optional) Signed URL expiry in seconds (default 3600).

Ensure your service account (used by `admin` / Firebase Admin SDK) has `roles/storage.objectAdmin` or similar permissions to write and generate signed URLs for objects in the bucket.

## Server-side invocation (example)

```ts
import { generateEvidencePack } from '@/ai/flows/generate-evidence-pack';

async function makeReport() {
  const input = {
    standards: ['GDPR_ART32', 'FDA_21CFR820'],
    dateRange: { from: '2024-01-01T00:00:00Z', to: '2024-12-31T23:59:59Z' }
  };

  const result = await generateEvidencePack(input);
  console.log('Report length:', result.report.length);
  if (result.signedUrl) {
    console.log('Download URL:', result.signedUrl);
  } else {
    console.log('Report not uploaded. Check TRACEABILITY_BUCKET and service account permissions.');
  }
}
```

## Notes

- If `TRACEABILITY_BUCKET` is not set or the service account lacks Storage permissions, the flow returns the `report` string and includes a short note appended to the report indicating the upload failed.
- The flow returns `signedUrl` when upload and signing succeed.

## Markdown and PDF output

- The flow now uploads a Markdown file (`.md`) of the report and returns `mdSignedUrl` when upload succeeds.
- If you set the env var `GENERATE_PDF=true` (or `1`), the flow will attempt to generate a PDF from the report using `puppeteer` and upload it as `.pdf`. When successful, the flow returns `pdfSignedUrl` and prefers the PDF as the primary `signedUrl`.
- `puppeteer` is optional; the flow dynamically imports it. If `puppeteer` is not installed or PDF generation fails, the flow still returns the Markdown `mdSignedUrl` (if upload succeeded) and appends a short note to the report describing the failure.

## Environment variables (summary)

- `TRACEABILITY_BUCKET` - GCS bucket name for uploads (required to store files).
- `TRACEABILITY_SIGNED_URL_EXPIRES_SECONDS` - Signed URL expiry in seconds (default `3600`).
- `GENERATE_PDF` - Set to `true` or `1` to enable PDF generation (requires optional `puppeteer` dependency).

Example to enable PDF generation locally (you'll need to install puppeteer):

```powershell
$env:TRACEABILITY_BUCKET = 'my-project-traceability'
$env:GENERATE_PDF = 'true'
npm install --save puppeteer
```
