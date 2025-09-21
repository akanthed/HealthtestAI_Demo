'use server';

/**
 * @fileOverview A test case customization AI agent.
 *
 * - customizeTestCaseGeneration - A function that handles the test case customization process.
 * - CustomizeTestCaseGenerationInput - The input type for the customizeTestCaseGeneration function.
 * - CustomizeTestCaseGenerationOutput - The return type for the customizeTestCaseGeneration function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CustomizeTestCaseGenerationInputSchema = z.object({
  requirementText: z.string().describe('The text of the requirement for which to generate test cases.'),
  prompt: z.string().describe('Specific instructions or prompts to guide the test case generation.'),
  complianceStandards: z.array(z.string()).describe('A list of compliance standards to include in the test cases (e.g., FDA, ISO 13485).'),
});
export type CustomizeTestCaseGenerationInput = z.infer<
  typeof CustomizeTestCaseGenerationInputSchema
>;

const CustomizeTestCaseGenerationOutputSchema = z.object({
  testCases: z.array(
    z.object({
      title: z.string().describe('The title of the test case.'),
      description: z.string().describe('A detailed description of the test case.'),
      preconditions: z.string().describe('The preconditions required to execute the test case.'),
      steps: z.array(z.string()).describe('A list of steps to execute the test case.'),
      expectedResults: z.string().describe('The expected results after executing the test case.'),
      priority: z.string().describe('The priority of the test case (High, Medium, Low).'),
      classificationTags: z.array(z.string()).describe('Tags for classifying the test case (e.g., Functional, Security, Compliance).'),
      complianceTags: z.array(z.string()).describe('Compliance standards tags applicable to the test case.'),
    })
  ).describe('An array of generated test cases.'),
});
export type CustomizeTestCaseGenerationOutput = z.infer<
  typeof CustomizeTestCaseGenerationOutputSchema
>;

export async function customizeTestCaseGeneration(
  input: CustomizeTestCaseGenerationInput
): Promise<CustomizeTestCaseGenerationOutput> {
  return customizeTestCaseGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customizeTestCaseGenerationPrompt',
  input: {schema: CustomizeTestCaseGenerationInputSchema},
  output: {schema: CustomizeTestCaseGenerationOutputSchema},
  prompt: `You are a QA expert specializing in generating test cases for healthcare software.

  Based on the requirement text, prompt, and compliance standards provided, generate a set of test cases.

  Requirement Text: {{{requirementText}}}
  Prompt: {{{prompt}}}
  Compliance Standards: {{#each complianceStandards}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Each test case should include a title, description, preconditions, steps, expected results, priority, classification tags, and compliance tags.

  Ensure the generated test cases are tailored to the specific needs and instructions provided in the prompt and adhere to the specified compliance standards.

  Output the test cases in a JSON format.
  `,
});

const customizeTestCaseGenerationFlow = ai.defineFlow(
  {
    name: 'customizeTestCaseGenerationFlow',
    inputSchema: CustomizeTestCaseGenerationInputSchema,
    outputSchema: CustomizeTestCaseGenerationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
