Smoke test: generate test cases linked to a requirement

Purpose
- Verify the generation proxy persists generated test cases with IDs in the `REQxxxTCxxx` format when a `requirementId` is provided, and that `requirements/{REQxxx}.nextTestCaseSeq` increments.

Prerequisites
- Firestore and Firebase Admin credentials available in `GOOGLE_APPLICATION_CREDENTIALS` environment variable (or service account JSON path). On Windows PowerShell:

  $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\inkantak\Desktop\Hackathon\GenAI\HealthTestAI\health_test_ai.json'

- Dev server running: `npm run dev` (Next.js app)
- A valid Firebase ID token for a signed-in user to pass in the Authorization header.

Steps
1. Create or identify a requirement in Firestore with id `REQ001` (or any `REQ###`). If you used the upsert API, call it if needed.

2. Call the generation endpoint with a payload that contains `requirementId: "REQ001"`. Example PowerShell `Invoke-RestMethod` (replace placeholders):

```powershell
$token = '<FIREBASE_ID_TOKEN>'
$body = @{
  requirementText = 'Sample requirement for smoke test'
  requirementId = 'REQ001'
  testTypes = @('functional')
}
$bodyJson = $body | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri 'http://localhost:9002/api/generateTestcases' -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $bodyJson -ContentType 'application/json'
```

3. Inspect the response for `_persistedIds`. These should contain ids like `REQ001TC001`, `REQ001TC002`, etc.

4. Verify in Firestore console that `testCases/{persistedId}` documents exist and have `requirementId: 'REQ001'`.

5. Verify `requirements/REQ001` document has `nextTestCaseSeq` incremented by the count of persisted test cases.

6. If anything fails, check server logs (Next.js dev console) for transaction errors and `_persistErrors` in the API response.

Notes
- If the external function already persisted test cases and returned `testCaseIds`, the proxy will trust those and will not re-persist. In that scenario `_persistedIds` will match the external function returned ids.
- If the requirement document can't be found in a transaction, the proxy falls back to generating a human-readable id for the test case (previous behavior) and adds the failure to `_persistErrors` in the response.
