const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3002;

// CORS configuration
const allowedOrigins = [
  'https://resume-match-frontend.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://10.1.10.38:3000',
  'http://10.1.10.38:3001'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Content-Length', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Max-Age', '86400');
  next();
});

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Resume Match API is running',
    version: '1.0.0',
    endpoints: {
      match: '/api/match',
      chat: '/api/chat'
    }
  });
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

    const resumeFile = req.files.resume[0];
    const jobDescFile = req.files.jobDesc[0];

    // Read and parse the files
    const resumeText = fs.readFileSync(resumeFile.path, 'utf8');
    const jobDescText = fs.readFileSync(jobDescFile.path, 'utf8');

    // Extract skills from job description
    const jobSkills = extractSkills(jobDescText);
    
    // Extract information from resume
    const resumeInfo = await analyzeResume(resumeText);
    
    // Calculate match percentage
    const matchResult = calculateMatch(resumeInfo, jobSkills);

    // Clean up uploaded files
    fs.unlinkSync(resumeFile.path);
    fs.unlinkSync(jobDescFile.path);

    console.log('Sending match response');
    
    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    
    // Send response
    return res.status(200).json(matchResult);
  } catch (error) {
    console.error('Error in match endpoint:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Helper function to extract skills from job description
function extractSkills(jobDescText) {
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'C++', 'React', 'Angular', 'Vue',
    'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'AWS', 'Azure',
    'GCP', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL',
    'MySQL', 'Git', 'CI/CD', 'Agile', 'Scrum', 'JIRA', 'REST', 'GraphQL',
    'TypeScript', 'HTML', 'CSS', 'SASS', 'Redux', 'MobX', 'Webpack',
    'Babel', 'Jest', 'Mocha', 'Selenium', 'Cypress', 'Linux', 'Shell',
    'Bash', 'PowerShell', 'DevOps', 'Microservices', 'API', 'Security',
    'Testing', 'QA', 'UI/UX', 'Design', 'Product Management'
  ];

  const skills = new Set();
  const text = jobDescText.toLowerCase();

  commonSkills.forEach(skill => {
    if (text.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  });

  return Array.from(skills);
}

// Helper function to analyze resume
async function analyzeResume(resumeText) {
  const text = resumeText.toLowerCase();
  
  // Extract skills
  const skills = extractSkills(resumeText);
  
  // Extract experience
  const experience = {
    jobs: [],
    totalExperience: 0,
    gaps: []
  };

  // Look for job history patterns
  const jobPatterns = [
    /(\d{4})\s*-\s*(present|current|\d{4})/gi,
    /(\d{4})\s*to\s*(present|current|\d{4})/gi,
    /(\d{4})\s*–\s*(present|current|\d{4})/gi
  ];

  let match;
  let lastEndDate = null;

  for (const pattern of jobPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      const startDate = parseInt(match[1]);
      const endDate = match[2].toLowerCase() === 'present' || match[2].toLowerCase() === 'current' 
        ? new Date().getFullYear() 
        : parseInt(match[2]);

      if (lastEndDate && startDate - lastEndDate > 1) {
        experience.gaps.push({
          period: `${lastEndDate} - ${startDate}`,
          duration: `${startDate - lastEndDate} years`
        });
      }

      lastEndDate = endDate;
      experience.totalExperience += (endDate - startDate);
    }
  }

  return {
    skills,
    experience
  };
}

// Helper function to calculate match
function calculateMatch(resumeInfo, jobSkills) {
  const matchingSkills = resumeInfo.skills.filter(skill => jobSkills.includes(skill));
  const missingSkills = jobSkills.filter(skill => !resumeInfo.skills.includes(skill));
  
  const skillMatchPercentage = (matchingSkills.length / jobSkills.length) * 100;
  
  // Calculate experience score (0-100)
  const experienceScore = Math.min(resumeInfo.experience.totalExperience * 20, 100);
  
  // Calculate overall match (weighted average: 70% skills, 30% experience)
  const overallMatch = Math.round((skillMatchPercentage * 0.7) + (experienceScore * 0.3));
  
  // Determine grade
  let grade;
  if (overallMatch >= 90) grade = "A+";
  else if (overallMatch >= 80) grade = "A";
  else if (overallMatch >= 70) grade = "B";
  else if (overallMatch >= 60) grade = "C";
  else if (overallMatch >= 50) grade = "D";
  else grade = "F";

  return {
    overallMatch: {
      percentage: overallMatch,
      grade: grade,
      summary: getMatchSummary(overallMatch, matchingSkills.length, missingSkills.length)
    },
    skills: {
      matching: matchingSkills.map(skill => ({ name: skill, match: 100 })),
      missing: missingSkills.map(skill => ({ name: skill, importance: "High" }))
    },
    experience: {
      averageTenure: `${resumeInfo.experience.totalExperience} years`,
      gaps: resumeInfo.experience.gaps,
      jobHistory: resumeInfo.experience.jobs
    },
    screeningQuestions: generateScreeningQuestions(matchingSkills, missingSkills)
  };
}

// Helper function to generate match summary
function getMatchSummary(matchPercentage, matchingSkillsCount, missingSkillsCount) {
  if (matchPercentage >= 90) {
    return "Excellent match with the job requirements";
  } else if (matchPercentage >= 80) {
    return "Strong match with the job requirements";
  } else if (matchPercentage >= 70) {
    return "Good match with the job requirements";
  } else if (matchPercentage >= 60) {
    return "Moderate match with the job requirements";
  } else if (matchPercentage >= 50) {
    return "Basic match with the job requirements";
  } else {
    return "Limited match with the job requirements";
  }
}

// Helper function to generate screening questions
function generateScreeningQuestions(matchingSkills, missingSkills) {
  const questions = [];
  
  // Questions about matching skills
  matchingSkills.forEach(skill => {
    questions.push(`Can you describe your experience with ${skill}?`);
  });
  
  // Questions about missing skills
  missingSkills.forEach(skill => {
    questions.push(`How would you approach learning ${skill} if required for this role?`);
  });
  
  // Add some general questions
  questions.push("What interests you about this position?");
  questions.push("How do you stay updated with industry trends?");
  
  return questions.slice(0, 5); // Return top 5 most relevant questions
}

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

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/`);
});