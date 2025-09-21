# **App Name**: HealthTestAI

## Core Features:

-- User Authentication: Secure user login and role management (QA, SME, Admin) using Firebase Authentication.
- Requirement Upload: Upload requirement documents (PDF, Word, XML) via Firebase Storage with progress tracking.
- AI Test Case Generation: Generate test cases (functional, security, compliance) based on requirements, with a tool selecting appropriate information using AI. Users can customize test case generation with specific prompts and compliance standards.
- Test Case Management: Display generated test cases in a real-time, card-based grid with status badges (Generated/Under Review/Approved), classification tags, and compliance indicators.
- Test Case Detail View: View and edit test case details with real-time collaboration features. This includes auto-saving, version history, and presence indicators.
- SME Review Workflow: Implement a Kanban board for SME review workflow, with columns for 'Generated', 'Under Review', 'Approved', and 'In Jira' statuses.
- Compliance Dashboard: Visualize real-time metrics, including total test cases by compliance standard, approval rates, and coverage percentages. Focus will remain on UI, with actual generation in external functions.

## Style Guidelines:

- Primary color: Medical Blue (#1976D2), inspired by the medical field, symbolizes trust, reliability, and health, and offers a calming and professional look.
- Background color: Light gray (#FAFAFA), almost white, to provide a clean, neutral backdrop that enhances readability and focuses attention on content.
- Accent color: Firebase Orange (#FF6F00) to draw attention to key interactive elements and CTAs.
- Body and headline font: 'Inter', a grotesque sans-serif, offering a clean and neutral look.
- Use Material Design icons for a consistent and familiar user experience.
- Implement a responsive 12-column CSS Grid system with mobile-first breakpoints.
- Incorporate subtle animations and transitions to provide feedback for user actions and enhance the overall user experience.