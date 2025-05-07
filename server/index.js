const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://resume-match-frontend.onrender.com', 'http://localhost:3000'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://192.168.0.37:3000', 'http://192.168.0.37:3001', 'http://192.168.0.37:3002', 'http://192.168.0.37:3003', 'http://192.168.0.37:3004'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Match endpoint
app.post('/api/match', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'jobDesc', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Received match request');
    console.log('Request headers:', req.headers);
    console.log('Request files:', req.files);
    
    if (!req.files || !req.files.resume || !req.files.jobDesc) {
      console.error('Missing files in request');
      return res.status(400).json({ error: 'Resume and job description files are required' });
    }

    // Mock response for now
    const mockResponse = {
      overallMatch: {
        percentage: 85,
        grade: "A",
        summary: "Strong match with the job requirements"
      },
      skills: {
        matching: [
          { name: "JavaScript", match: 90 },
          { name: "React", match: 85 },
          { name: "Node.js", match: 80 }
        ],
        missing: [
          { name: "Python", importance: "Medium" },
          { name: "AWS", importance: "High" }
        ]
      },
      experience: {
        averageTenure: "2.5 years",
        gaps: [
          { period: "Jan 2020 - Mar 2020", duration: "3 months" }
        ],
        jobHistory: [
          { company: "Tech Corp", duration: "2 years", role: "Senior Developer" },
          { company: "StartUp Inc", duration: "1 year", role: "Developer" }
        ]
      },
      screeningQuestions: [
        "Can you describe your experience with React?",
        "How have you handled scaling applications in the past?",
        "What's your approach to testing?"
      ]
    };

    console.log('Sending match response');
    res.json(mockResponse);
  } catch (error) {
    console.error('Error in match endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Received chat request:', JSON.stringify(req.body, null, 2));
    const { message, matchResult } = req.body;

    if (!message || !matchResult) {
      console.error('Missing required fields:', { message: !!message, matchResult: !!matchResult });
      return res.status(400).json({ error: 'Missing required fields' });
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

Please provide a direct, concise answer to the user's question. Focus on answering the specific question asked, using the data provided. Avoid repeating information that was already shown in the match results unless directly relevant to the question.`;

    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
        {
          headers: {
            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 1024,
              temperature: 0.7,
              return_full_text: false
            }
          }),
        }
      );

      const result = await response.json();
      return res.json({ response: result[0].generated_text });
    } catch (apiError) {
      console.error('HuggingFace API error:', apiError);
      return res.json({ 
        response: "I apologize, but I'm having trouble accessing the AI system. Please try again later."
      });
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
}); 