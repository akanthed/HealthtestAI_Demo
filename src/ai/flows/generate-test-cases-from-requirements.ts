// Use in your UI
// Keep base URL without the endpoint so we can append the path when calling.
const API_BASE_URL = 'https://healthcare-rag-api-704193825673.us-central1.run.app';

export async function generateTestCases(requirement: string, testTypes: string[] | undefined) {
    const response = await fetch(`${API_BASE_URL}/generate-test-cases`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            requirement_text: requirement,
            test_types: testTypes
        })
    });
    
    return await response.json();
}

export default generateTestCases;

