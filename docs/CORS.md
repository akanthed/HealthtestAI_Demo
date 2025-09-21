# Configuring CORS for the traceability GCS bucket

This document shows how to add a CORS policy to your Google Cloud Storage bucket so browser `fetch()` calls to signed URLs from `http://localhost:9002` (dev) or your production origin will succeed.

1) Create or review `cors.json` in the repository root. Example:

```json
[
  {
    "origin": ["http://localhost:9002", "http://localhost:3000", "https://your-production-domain.com"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition", "x-goog-meta-*"],
    "maxAgeSeconds": 3600
  }
]
```

2) Apply the CORS config using `gsutil` (recommended) or `gcloud storage` (newer CLI).

PowerShell examples (run from repo root or provide full path to `cors.json`):

- Using `gsutil`:

```powershell
# Authenticate (if not already):
# gcloud auth login
# gcloud auth application-default login

# Apply CORS config to your bucket
gsutil cors set .\cors.json gs://skillful-jetty-467110-v3-temp

# Verify
gsutil cors get gs://skillful-jetty-467110-v3-temp
```

- Using `gcloud storage`:

```powershell
# Authenticate (if not already):
# gcloud auth login
# gcloud auth application-default login

# Apply CORS config to your bucket (gcloud 413+)
gcloud storage buckets update gs://skillful-jetty-467110-v3-temp --cors-file=.\cors.json

# Verify
gcloud storage buckets describe gs://skillful-jetty-467110-v3-temp --format="json(cors)"
```

Notes
- Restrict origins to the exact domains you need in production — avoid `*` unless you understand the security implications.
- `responseHeader` must contain headers you expect to read from the response; include `Content-Disposition` if you want the browser to honor attachment filenames.
- CORS changes may take a few minutes to propagate.

If you'd like, I can also add a Next.js API proxy that streams files (server-side) so you don't need to rely on bucket CORS at all.
