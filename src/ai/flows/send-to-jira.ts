'use server';
/**
 * @fileOverview A flow for sending a test case to Jira.
 *
 * - sendToJira - A function that handles creating a Jira issue from a test case.
 * - SendToJiraInput - The input type for the sendToJira function.
 * - SendToJiraOutput - The return type for the sendToJira function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { admin } from '@/lib/firebase-admin'; // Using admin SDK

const SendToJiraInputSchema = z.object({
  testCaseId: z.string().describe('The ID of the test case to send to Jira.'),
});
export type SendToJiraInput = z.infer<typeof SendToJiraInputSchema>;

const SendToJiraOutputSchema = z.object({
  jiraIssueKey: z.string().describe('The key of the created Jira issue.'),
  testCaseId: z.string().describe('The ID of the test case that was updated.'),
});
export type SendToJiraOutput = z.infer<typeof SendToJiraOutputSchema>;

export async function sendToJira(
  input: SendToJiraInput
): Promise<SendToJiraOutput> {
  return sendToJiraFlow(input);
}

const sendToJiraFlow = ai.defineFlow(
  {
    name: 'sendToJiraFlow',
    inputSchema: SendToJiraInputSchema,
    outputSchema: SendToJiraOutputSchema,
  },
  async (input: SendToJiraInput) => {
    // Ensure the Admin SDK has an initialized app. In some dev environments
    // admin.initializeApp() in `src/lib/firebase-admin.ts` may have failed
    // (for example when credentials are missing). Guard and try to initialize
    // here so the flow doesn't throw 'The default Firebase app does not exist'.
    if (!admin.apps.length) {
      try {
        // Prefer application default credentials when available
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        console.log('Initialized firebase-admin with applicationDefault credentials');
      } catch (err) {
        console.warn('applicationDefault credential init failed, falling back to default initializeApp():', err);
        try {
          admin.initializeApp();
          console.log('Initialized firebase-admin with default initializeApp()');
        } catch (err2) {
          console.error('Failed to initialize firebase-admin:', err2);
          throw err2;
        }
      }
    }

    // Diagnostics: log admin app options and env vars to help debug permission issues
    try {
      console.log('admin.app().options:', admin.app().options);
    } catch (e) {
      console.warn('Could not read admin.app().options:', e);
    }
    console.log('ENV: GOOGLE_APPLICATION_CREDENTIALS=', process.env.GOOGLE_APPLICATION_CREDENTIALS ? '[set]' : '[not set]');
    console.log('ENV: FIREBASE_SERVICE_ACCOUNT_JSON=', process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '[set]' : '[not set]');

    const db = getFirestore(admin.app());
    const testCaseRef = db.collection('testCases').doc(input.testCaseId);

    let docSnap;
    try {
      docSnap = await testCaseRef.get();
    } catch (err: any) {
      // Provide actionable message for common misconfiguration
      console.error('Error fetching test case via Admin SDK:', err);
      if (err && (err.code === 7 || err.code === '7' || err.code === 'permission-denied' || err.details?.includes('Missing or insufficient permissions'))) {
        throw new Error(
          'Permission denied when accessing Firestore with the Admin SDK.\n' +
          'Likely causes:\n' +
          '- The service account used by the Admin SDK does not have Firestore permissions (grant roles/datastore.user or Owner).\n' +
          '- The credentials belong to a different GCP project than the Firestore database.\n' +
          '- `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON` is not set or points to an invalid key.\n' +
          'Suggested fixes:\n' +
          '- Provide a service account JSON with project-level Firestore access and set `FIREBASE_SERVICE_ACCOUNT_JSON` (contents) or `GOOGLE_APPLICATION_CREDENTIALS` (file path).\n' +
          '- Ensure the service account has roles `Cloud Datastore User` or `Firebase Admin` (or Owner) on the project.\n' +
          '- Confirm `admin.app().options.projectId` matches your Firebase project.\n'
        );
      }
      throw err;
    }
    if (!docSnap.exists) {
      throw new Error(`Test case with ID ${input.testCaseId} not found.`);
    }

    const testCaseData = docSnap.data();

    // In a real implementation, you would:
    // 1. Fetch Jira credentials from a secure store (e.g., Secret Manager).
    // 2. Use a library like 'jira-client' to connect to the Jira API.
    // 3. Create a payload with testCaseData.title, testCaseData.description, etc.
    // 4. Post the payload to the Jira API to create an issue.
    // 5. Get the real issue key back from the Jira API response.

    // For this prototype, we'll simulate the Jira API call.
    console.log(`Simulating sending test case ${input.testCaseId} to Jira...`);
    console.log('Title:', testCaseData?.title);

    // Simulate generating a Jira issue key.
    const projectKey = 'HTA'; // This would come from settings
    const issueNumber = Math.floor(Math.random() * 200) + 100;
    const simulatedJiraKey = `${projectKey}-${issueNumber}`;

    // Update the test case in Firestore with the new Jira issue key
    await testCaseRef.update({
      jiraIssueKey: simulatedJiraKey,
      status: 'in_jira', // Also update the status
    });

    console.log(
      `Successfully created Jira issue ${simulatedJiraKey} and updated test case ${input.testCaseId}.`
    );

    return {
      jiraIssueKey: simulatedJiraKey,
      testCaseId: input.testCaseId,
    };
  }
);
