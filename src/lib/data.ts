
export type TestCase = {
    id: string;
    test_case_id?: string;
    requirementId?: string;
    title: string;
    description: string;
    test_type?: string;
    preconditions?: string;
    steps: string[];
    test_steps?: string[];
    expectedResults?: string;
    expected_results?: string;
    postconditions?: string;
    priority?: 'High' | 'Medium' | 'Low';
    severity?: 'Critical' | 'High' | 'Medium' | 'Low';
    test_data?: string;
    environment?: string;
    automation_feasible?: boolean;
    estimated_duration?: string;
    classificationTags?: string[];
    complianceTags: string[];
    compliance_tags?: string[];
    // New fields from generateTestcases output
    standard_references?: string[];
    evidence_needed?: string[];
    iec_62304_class?: string;
    risk_level?: string;
    traceability?: string;
    jiraIssueKey?: string;
    status: 'generated' | 'under_review' | 'approved' | 'in_jira';
    reviewedBy?: string;
    createdAt?: string;
};


export const testCases: TestCase[] = [
    {
        id: 'TC-001',
        requirementId: 'REQ-001',
        title: 'User Login with Valid Credentials',
        description: 'Verify that a user can successfully log in with a valid email and password.',
        preconditions: 'User must be registered and have an active account. The system must be online.',
        steps: ['Navigate to the login page.', 'Enter a valid email address.', 'Enter the corresponding valid password.', 'Click the "Sign In" button.'],
        expectedResults: 'User is redirected to the dashboard page and a success message is displayed.',
        priority: 'High',
        classificationTags: ['Functional', 'Authentication'],
        complianceTags: ['HIPAA'],
        jiraIssueKey: 'HTA-101',
        status: 'approved',
        reviewedBy: 'Alice Johnson',
        createdAt: '2023-10-26T10:00:00Z',
    },
    {
        id: 'TC-002',
        requirementId: 'REQ-001',
        title: 'User Login with Invalid Password',
        description: 'Verify that a user cannot log in with an invalid password.',
        preconditions: 'User must be registered. The system must be online.',
        steps: ['Navigate to the login page.', 'Enter a valid email address.', 'Enter an invalid password.', 'Click the "Sign In" button.'],
        expectedResults: 'An error message "Invalid credentials" is displayed. User remains on the login page.',
        priority: 'High',
        classificationTags: ['Functional', 'Authentication', 'Negative'],
        complianceTags: ['HIPAA'],
        jiraIssueKey: 'HTA-102',
        status: 'under_review',
        reviewedBy: '',
        createdAt: '2023-10-26T10:05:00Z',
    },
    {
        id: 'TC-003',
        requirementId: 'REQ-002',
        title: 'Upload Requirement Document (PDF)',
    description: 'Verify that a QA can upload a requirement document in PDF format.',
    preconditions: 'User must be logged in as a QA.',
        steps: ['Navigate to the Requirements page.', 'Drag and drop a PDF file into the upload zone.', 'Wait for the upload to complete.'],
        expectedResults: 'The file is uploaded successfully and appears in the list of uploaded documents with a "Processing" status.',
        priority: 'Medium',
        classificationTags: ['Functional', 'File Upload'],
        complianceTags: ['FDA', 'ISO 13485'],
        jiraIssueKey: '',
        status: 'generated',
        reviewedBy: '',
        createdAt: '2023-10-27T11:30:00Z',
    },
    {
        id: 'TC-004',
        requirementId: 'REQ-003',
        title: 'Generate Test Cases using AI',
        description: 'Verify that AI can generate test cases from an uploaded requirement.',
        preconditions: 'A requirement document must be uploaded and processed.',
        steps: ['Navigate to the Requirements page.', 'Select a processed requirement.', 'Enter a prompt in the AI generation panel.', 'Click "Generate with AI".'],
        expectedResults: 'A set of test cases is generated and displayed in the Test Cases grid with "Generated" status.',
        priority: 'High',
        classificationTags: ['Functional', 'AI'],
        complianceTags: ['IEC 62304'],
        jiraIssueKey: 'HTA-105',
        status: 'in_jira',
        reviewedBy: 'Bob Williams',
        createdAt: '2023-10-28T14:00:00Z',
    },
    {
        id: 'TC-005',
        requirementId: 'REQ-002',
        title: 'Review and Approve a Test Case',
        description: 'Verify that an SME can review and approve a generated test case.',
        preconditions: 'User is logged in as an SME. A test case has "Generated" status.',
        steps: ['Navigate to the Review Workflow page.', 'Drag a test case card from "Generated" to "Under Review".', 'Open the test case review modal.', 'Check the Definition of Done items.', 'Click the "Approve" button.'],
        expectedResults: 'The test case status changes to "Approved" and moves to the "Approved" column on the Kanban board.',
        priority: 'Medium',
        classificationTags: ['Functional', 'Workflow'],
        complianceTags: ['FDA'],
        jiraIssueKey: 'HTA-108',
        status: 'approved',
        reviewedBy: 'Carol White',
        createdAt: '2023-10-29T09:00:00Z',
    },
];
