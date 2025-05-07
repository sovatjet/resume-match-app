const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Ollama } = require('ollama');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://192.168.0.37:3000', 'http://192.168.0.37:3001', 'http://192.168.0.37:3002', 'http://192.168.0.37:3003', 'http://192.168.0.37:3004'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Initialize Ollama client
const ollama = new Ollama({
  host: 'http://localhost:11434'
});

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

    // Create a more concise prompt for the AI
    const prompt = `Context: ${matchResult.overallMatch.percentage}% match, ${matchResult.experience.averageTenure} avg tenure
Question: ${message}

Answer in 1-2 short sentences.`;

    console.log('Sending request to Ollama...');
    try {
      const response = await ollama.chat({
        model: 'mistral',
        messages: [
          {
            role: 'system',
            content: 'You are a direct HR assistant. Give extremely brief answers (1-2 sentences max). No greetings, no explanations, just answer the question.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature: 0.5, // Reduced for more focused responses
          num_predict: 128, // Further reduced for faster responses
        }
      });

      console.log('Received response from Ollama:', JSON.stringify(response, null, 2));
      return res.json({ response: response.message.content });
    } catch (ollamaError) {
      console.error('Ollama API error:', ollamaError);
      
      return res.json({ 
        response: "I apologize, but I'm having trouble accessing the AI system. Please ensure Ollama is running on your system (http://localhost:11434)."
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