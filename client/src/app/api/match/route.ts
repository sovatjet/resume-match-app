import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const resume = formData.get('resume');
    const jobDesc = formData.get('jobDesc');

    if (!resume || !jobDesc) {
      return NextResponse.json(
        { error: 'Resume and job description are required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual resume matching logic here
    // For now, returning a mock response with the new structure
    return NextResponse.json({
      overallMatch: {
        percentage: 85,
        grade: "B+",
        summary: "Strong match with some areas for improvement"
      },
      skills: {
        matching: [
          { name: "React", match: 95 },
          { name: "TypeScript", match: 90 },
          { name: "Node.js", match: 85 },
          { name: "AWS", match: 75 }
        ],
        missing: [
          { name: "GraphQL", importance: "High" },
          { name: "Docker", importance: "Medium" }
        ]
      },
      experience: {
        averageTenure: "2.5 years",
        gaps: [
          { period: "Jan 2022 - Mar 2022", duration: "3 months" }
        ],
        jobHistory: [
          { company: "Tech Corp", duration: "2 years", role: "Senior Developer" },
          { company: "StartUp Inc", duration: "1.5 years", role: "Full Stack Developer" }
        ]
      },
      screeningQuestions: [
        "Can you elaborate on your experience with GraphQL and how you've used it in previous projects?",
        "What's your approach to containerization and how have you used Docker in production environments?",
        "How do you handle technical debt and what strategies have you used to maintain code quality?"
      ]
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 