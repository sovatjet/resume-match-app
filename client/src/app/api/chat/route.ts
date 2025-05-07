import { NextResponse } from 'next/server';
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: 'http://localhost:11434'
});

interface ChatRequest {
  message: string;
  matchResult: {
    overallMatch: {
      percentage: number;
      grade: string;
      summary: string;
    };
    skills: {
      matching: Array<{ name: string; match: number }>;
      missing: Array<{ name: string; importance: string }>;
    };
    experience: {
      averageTenure: string;
      gaps: Array<{ period: string; duration: string }>;
      jobHistory: Array<{ company: string; duration: string; role: string }>;
    };
    screeningQuestions: string[];
  };
}

function generateResponse(message: string, matchResult: ChatRequest['matchResult']): string {
  const lowerMessage = message.toLowerCase();
  
  // Overall match questions
  if (lowerMessage.includes('match') || lowerMessage.includes('score') || lowerMessage.includes('grade')) {
    return `The overall match is ${matchResult.overallMatch.percentage}% (${matchResult.overallMatch.grade}). ${matchResult.overallMatch.summary}`;
  }

  // Skills analysis
  if (lowerMessage.includes('skill') || lowerMessage.includes('competency')) {
    if (lowerMessage.includes('missing') || lowerMessage.includes('gap')) {
      const missingSkills = matchResult.skills.missing
        .map(s => `${s.name} (${s.importance} importance)`)
        .join(', ');
      return `The candidate is missing these skills: ${missingSkills}. I recommend focusing on the high-importance skills during the interview.`;
    }
    
    const topSkills = matchResult.skills.matching
      .sort((a, b) => b.match - a.match)
      .slice(0, 3)
      .map(s => `${s.name} (${s.match}% match)`)
      .join(', ');
    return `The candidate's strongest matching skills are: ${topSkills}.`;
  }

  // Experience analysis
  if (lowerMessage.includes('experience') || lowerMessage.includes('tenure') || lowerMessage.includes('job')) {
    let response = `The candidate's average tenure is ${matchResult.experience.averageTenure}. `;
    
    if (matchResult.experience.gaps.length > 0) {
      response += `There are ${matchResult.experience.gaps.length} employment gaps: ${matchResult.experience.gaps
        .map(g => `${g.period} (${g.duration})`)
        .join(', ')}. `;
    }
    
    response += `Recent roles include: ${matchResult.experience.jobHistory
      .map(j => `${j.role} at ${j.company} (${j.duration})`)
      .join(', ')}.`;
    
    return response;
  }

  // Screening questions
  if (lowerMessage.includes('question') || lowerMessage.includes('ask') || lowerMessage.includes('interview')) {
    return `Here are the recommended screening questions:\n${matchResult.screeningQuestions
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n')}`;
  }

  // Areas for improvement
  if (lowerMessage.includes('improve') || lowerMessage.includes('better') || lowerMessage.includes('concern')) {
    const concerns = [];
    
    if (matchResult.overallMatch.percentage < 70) {
      concerns.push(`The overall match is below 70% (${matchResult.overallMatch.percentage}%)`);
    }
    
    const highImportanceMissing = matchResult.skills.missing
      .filter(s => s.importance.toLowerCase() === 'high')
      .map(s => s.name);
    if (highImportanceMissing.length > 0) {
      concerns.push(`Missing high-importance skills: ${highImportanceMissing.join(', ')}`);
    }
    
    if (matchResult.experience.gaps.length > 0) {
      concerns.push(`Has ${matchResult.experience.gaps.length} employment gaps`);
    }
    
    if (concerns.length === 0) {
      return "The candidate appears to be a strong match for the position. No major concerns were identified.";
    }
    
    return `Key areas of concern:\n${concerns.map(c => `- ${c}`).join('\n')}`;
  }

  // Help/General questions
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    return `I can help you understand:
1. The overall match score and grade
2. Matching and missing skills
3. Employment gaps and tenure
4. Recommended screening questions
5. Areas for improvement
Just ask me about any of these topics!`;
  }

  // Default response
  return "I can help you analyze the match results. You can ask me about the overall match, skills, experience, screening questions, or areas for improvement. What would you like to know?";
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { message, matchResult } = body;

    if (!message || !matchResult) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create a context-aware prompt for the AI
    const prompt = `You are an AI assistant specializing in resume matching and candidate analysis. Here is the current match result:

Overall Match: ${matchResult.overallMatch.percentage}% (${matchResult.overallMatch.grade})
Summary: ${matchResult.overallMatch.summary}

Matching Skills:
${matchResult.skills.matching.map(s => `- ${s.name}: ${s.match}%`).join('\n')}

Missing Skills:
${matchResult.skills.missing.map(s => `- ${s.name} (${s.importance} importance)`).join('\n')}

Experience:
- Average Tenure: ${matchResult.experience.averageTenure}
- Employment Gaps: ${matchResult.experience.gaps.length > 0 
  ? matchResult.experience.gaps.map(g => `${g.period} (${g.duration})`).join(', ')
  : 'None found'}
- Job History: ${matchResult.experience.jobHistory.map(j => 
  `${j.role} at ${j.company} (${j.duration})`).join(', ')}

Screening Questions:
${matchResult.screeningQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

User Question: ${message}

Please provide a helpful, detailed response based on the above information. Focus on being informative and professional. Consider industry standards and best practices in your response.`;

    try {
      const response = await ollama.chat({
        model: 'mistral',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR and recruitment assistant with deep knowledge of the tech industry, hiring practices, and candidate evaluation. Provide detailed, insightful responses that help users understand candidate qualifications and make informed decisions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature: 0.7,
          num_predict: 1024,
        }
      });

      return NextResponse.json({ response: response.message.content });
    } catch (ollamaError: any) {
      console.error('Ollama API error:', ollamaError);
      
      // Fallback to rule-based system if Ollama is not available
      return NextResponse.json({ 
        response: "I apologize, but I'm having trouble accessing the AI system. Please ensure Ollama is running on your system (http://localhost:11434). You can start it by running 'ollama serve' in a terminal."
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
} 