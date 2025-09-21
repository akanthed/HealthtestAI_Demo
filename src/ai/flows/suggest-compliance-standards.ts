'use server';

/**
 * @fileOverview An AI agent that suggests relevant compliance standards based on the uploaded requirement document.
 *
 * - suggestComplianceStandards - A function that handles the suggestion of compliance standards.
 * - SuggestComplianceStandardsInput - The input type for the suggestComplianceStandards function.
 * - SuggestComplianceStandardsOutput - The return type for the suggestComplianceStandards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestComplianceStandardsInputSchema = z.object({
  requirementDocument: z
    .string()
    .describe(
      'The requirement document as a string.'
    ),
});
export type SuggestComplianceStandardsInput = z.infer<
  typeof SuggestComplianceStandardsInputSchema
>;

const SuggestComplianceStandardsOutputSchema = z.object({
  suggestedStandards: z
    .array(z.string())
    .describe('An array of suggested compliance standards.'),
});
export type SuggestComplianceStandardsOutput = z.infer<
  typeof SuggestComplianceStandardsOutputSchema
>;

export async function suggestComplianceStandards(
  input: SuggestComplianceStandardsInput
): Promise<SuggestComplianceStandardsOutput> {
  return suggestComplianceStandardsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestComplianceStandardsPrompt',
  input: {schema: SuggestComplianceStandardsInputSchema},
  output: {schema: SuggestComplianceStandardsOutputSchema},
  prompt: `You are an expert in regulatory compliance for the healthcare industry. Given the following requirement document, suggest relevant compliance standards. Return the answer as a JSON array of strings.

Requirement Document:
{{{requirementDocument}}}

Suggested Compliance Standards:`,
});

const suggestComplianceStandardsFlow = ai.defineFlow(
  {
    name: 'suggestComplianceStandardsFlow',
    inputSchema: SuggestComplianceStandardsInputSchema,
    outputSchema: SuggestComplianceStandardsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
