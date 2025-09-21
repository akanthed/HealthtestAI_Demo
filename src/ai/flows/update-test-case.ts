'use server';
/**
 * @fileOverview A flow for updating a test case using an AI prompt.
 *
 * - updateTestCase - A function that handles updating a test case with AI.
 * - UpdateTestCaseInput - The input type for the updateTestCase function.
 * - UpdateTestCaseOutput - The return type for the updateTestCase function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin } from '@/lib/firebase-admin';

const UpdateTestCaseInputSchema = z.object({
  testCaseId: z.string().describe('The ID of the test case to update.'),
  prompt: z.string().describe('The user prompt with instructions on how to update the test case.'),
});
export type UpdateTestCaseInput = z.infer<typeof UpdateTestCaseInputSchema>;

const UpdateTestCaseOutputSchema = z.object({
  testCaseId: z.string(),
  success: z.boolean(),
});
export type UpdateTestCaseOutput = z.infer<typeof UpdateTestCaseOutputSchema>;

export async function updateTestCase(input: UpdateTestCaseInput): Promise<UpdateTestCaseOutput> {
  return updateTestCaseFlow(input);
}

const updateTestCaseFlow = ai.defineFlow(
  {
    name: 'updateTestCaseFlow',
    inputSchema: UpdateTestCaseInputSchema,
    outputSchema: UpdateTestCaseOutputSchema,
  },
  async (input) => {
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
    const db = admin.firestore();
    const testCaseRef = db.collection('testCases').doc(input.testCaseId);

    const docSnap = await testCaseRef.get();
    if (!docSnap.exists) {
      throw new Error(`Test case with ID ${input.testCaseId} not found.`);
    }
    const testCaseData = docSnap.data();

    const result = await ai.generate({
        prompt: `You are a QA expert. Update the following test case based on the prompt.
        
        Original Test Case (JSON):
        ${JSON.stringify(testCaseData)}

        User Prompt: "${input.prompt}"

        Return only the updated test case fields as a valid JSON object. Do not wrap it in markdown.
        For example, if the prompt is "change the priority to high", you should return:
        { "priority": "High" }
        `,
        model: 'googleai/gemini-2.5-flash',
        config: {
          temperature: 0.1,
        }
    });

    // Normalize result text from the AI generator (support various SDK shapes)
    let updateText: string;
    if (typeof result === 'string') {
      updateText = result;
    } else if (typeof (result as any).text === 'function') {
      updateText = (result as any).text();
    } else if (typeof (result as any).text === 'string') {
      updateText = (result as any).text;
    } else if (typeof (result as any).toString === 'function') {
      updateText = (result as any).toString();
    } else {
      updateText = JSON.stringify(result);
    }
    let updatedFields: any;
    try {
        updatedFields = JSON.parse(updateText);
    } catch (e) {
        console.error("Failed to parse AI response:", updateText);
        throw new Error("The AI returned an invalid format. Please try again.");
    }
    
    // To prevent the AI from overwriting critical fields, we only allow certain fields to be updated.
  // Allowed fields (kept as a const array to avoid overly-strict keyof typing)
  const allowedUpdates = [
    'title', 'description', 'preconditions', 'steps', 'test_steps', 'expectedResults', 'expected_results', 'postconditions',
    'priority', 'severity', 'test_data', 'environment', 'automation_feasible', 'estimated_duration'
  ] as const;

  const finalUpdates: any = {};
  for (const key of allowedUpdates) {
    const k = key as string;
    if (updatedFields && updatedFields[k] !== undefined) {
      finalUpdates[k] = updatedFields[k];
    }
  }
    
    // Special handling for steps which might be named differently
    if (finalUpdates.steps && !finalUpdates.test_steps) {
        finalUpdates.test_steps = finalUpdates.steps;
    }
    
    // Special handling for expected results which might be named differently
    if (finalUpdates.expectedResults && !finalUpdates.expected_results) {
        finalUpdates.expected_results = finalUpdates.expectedResults;
    }


    if (Object.keys(finalUpdates).length > 0) {
        await testCaseRef.update({
            ...finalUpdates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return {
      testCaseId: input.testCaseId,
      success: true,
    };
  }
);
