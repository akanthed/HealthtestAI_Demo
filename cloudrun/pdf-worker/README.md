PDF worker (Cloud Run)

This worker receives HTML and uploads a generated PDF to GCS, returning a signed URL.

Deploy (Cloud Run):

1) Build and push container (from repo root):
   docker build -t gcr.io/YOUR_PROJECT_ID/pdf-worker:latest ./cloudrun/pdf-worker
   docker push gcr.io/YOUR_PROJECT_ID/pdf-worker:latest

2) Deploy to Cloud Run:
   gcloud run deploy pdf-worker --image gcr.io/YOUR_PROJECT_ID/pdf-worker:latest --platform managed --region us-central1 --allow-unauthenticated

3) Set `CLOUDRUN_PDF_URL` in your app to the public URL of the worker (e.g. https://pdf-worker-xxxxx-uc.a.run.app/render-pdf)

Security: For production, protect the endpoint (IAM or token) and use signed requests. The worker uses ADC to write to GCS; ensure the service account has Storage roles.
