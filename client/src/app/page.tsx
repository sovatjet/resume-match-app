"use client";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Grid, Typography, Box, Button, Paper, Container, List, ListItem, ListItemText, Divider, TextField, IconButton } from "@mui/material";
import { useDropzone } from "react-dropzone";
import SendIcon from '@mui/icons-material/Send';

interface MatchResult {
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
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://resume-match-backend.onrender.com';

// Custom debounce hook
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

export default function Page() {
  const [resume, setResume] = useState<File | null>(null);
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize dropzone configurations
  const resumeDropzoneConfig = useMemo(() => ({
    onDrop: (acceptedFiles: File[]) => setResume(acceptedFiles[0]),
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
  }), []);

  const jobDescDropzoneConfig = useMemo(() => ({
    onDrop: (acceptedFiles: File[]) => setJobDescFile(acceptedFiles[0]),
    accept: {
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
  }), []);

  // Resume Dropzone
  const {
    getRootProps: getResumeRootProps,
    getInputProps: getResumeInputProps,
    isDragActive: isResumeDragActive,
  } = useDropzone(resumeDropzoneConfig);

  // Job Description Dropzone
  const {
    getRootProps: getJobDescRootProps,
    getInputProps: getJobDescInputProps,
    isDragActive: isJobDescDragActive,
  } = useDropzone(jobDescDropzoneConfig);

  // Debounced chat input handler
  const debouncedSetChatInput = useDebounce((value: string) => {
    setChatInput(value);
  }, 100);

  const handleChatInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.persist();
    debouncedSetChatInput(e.target.value);
  }, [debouncedSetChatInput]);

  const handleMatch = useCallback(async () => {
    if (!resume || !jobDescFile || isLoading) return;
    
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setResult(null);
    try {
      console.log('Starting match request...');
      console.log('Files:', { resume: resume.name, jobDesc: jobDescFile.name });
      
      const formData = new FormData();
      formData.append("resume", resume);
      formData.append("jobDesc", jobDescFile);
      
      console.log('Sending request to:', `${API_BASE_URL}/api/match`);
      const response = await fetch(`${API_BASE_URL}/api/match`, {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal
      });
      
      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data);
      
      setResult(data);
      setChatMessages([{
        role: 'assistant',
        content: `I've analyzed the resume and job description. The overall match is ${data.overallMatch.percentage}% (${data.overallMatch.grade}). How can I help you understand the results better?`
      }]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Error in match:', err);
      setChatMessages([{
        role: 'assistant',
        content: "I'm sorry, there was an error processing your files. Please try again."
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [resume, jobDescFile, isLoading]);

  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !result || isLoading) return;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController
    abortControllerRef.current = new AbortController();

    const newMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
    setIsLoading(true);

    try {
      console.log('Sending chat request:', { message: chatInput, matchResult: result });
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chatInput,
          matchResult: result
        }),
        signal: abortControllerRef.current.signal
      });

      console.log('Received response status:', response.status);
      const data = await response.json();
      console.log('Received response data:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || `HTTP error! status: ${response.status}`);
      }
      
      if (data.error) {
        throw new Error(data.details || data.error);
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Error in chat:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: err instanceof Error ? err.message : "I'm sorry, I encountered an error while processing your question. Please try again."
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [chatInput, result, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#4169e1", py: 6 }}>
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: 4 }}>
          {/* Logo and Title */}
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <img
              src="/logo.png"
              alt="Company Logo"
              style={{ height: 64, objectFit: "contain" }}
            />
          </Box>
          <Typography variant="h4" gutterBottom align="center" fontWeight="bold">
            Resume-Job Matcher
          </Typography>

          {/* Upload Section */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom align="center" fontWeight="bold">
                Upload Resume (Drag & Drop or Click):
              </Typography>
              <Box
                {...getResumeRootProps()}
                sx={{
                  border: "2px dashed #1976d2",
                  borderRadius: 2,
                  p: 2,
                  textAlign: "center",
                  bgcolor: isResumeDragActive ? "#e3f2fd" : "#fafafa",
                  cursor: "pointer",
                  minHeight: 100,
                }}
              >
                <input {...getResumeInputProps()} />
                {resume ? (
                  <Typography variant="body2" align="center" fontWeight="bold">
                    Selected: {resume.name}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="textSecondary" align="center" fontWeight="bold">
                    Drag & drop a resume file here, or click to select
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom align="center" fontWeight="bold">
                Upload Job Description (Drag & Drop or Click):
              </Typography>
              <Box
                {...getJobDescRootProps()}
                sx={{
                  border: "2px dashed #1976d2",
                  borderRadius: 2,
                  p: 2,
                  textAlign: "center",
                  bgcolor: isJobDescDragActive ? "#e3f2fd" : "#fafafa",
                  cursor: "pointer",
                  minHeight: 100,
                }}
              >
                <input {...getJobDescInputProps()} />
                {jobDescFile ? (
                  <Typography variant="body2" align="center" fontWeight="bold">
                    Selected: {jobDescFile.name}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="textSecondary" align="center" fontWeight="bold">
                    Drag & drop a job description file here, or click to select
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            color="primary"
            onClick={handleMatch}
            disabled={!resume || !jobDescFile}
            fullWidth
            sx={{ mt: 3, fontWeight: "bold" }}
          >
            Match Resume
          </Button>

          {/* Results Section */}
          {result && (
            <Grid container spacing={3} sx={{ mt: 2 }}>
              {/* Main Results */}
              <Grid item xs={12} md={8}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: "#f5f5f5" }}>
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    Match Results
                  </Typography>
                  
                  {/* Overall Match */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      Overall Match: {result.overallMatch.percentage}% ({result.overallMatch.grade})
                    </Typography>
                    <Typography variant="body1">{result.overallMatch.summary}</Typography>
                  </Box>

                  {/* Skills Analysis */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Skills Analysis
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" color="success.main" gutterBottom>
                          Matching Skills
                        </Typography>
                        <List dense>
                          {result.skills.matching.map((skill, index) => (
                            <ListItem key={index}>
                              <ListItemText
                                primary={skill.name}
                                secondary={`${skill.match}% match`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" color="error.main" gutterBottom>
                          Missing Skills
                        </Typography>
                        <List dense>
                          {result.skills.missing.map((skill, index) => (
                            <ListItem key={index}>
                              <ListItemText
                                primary={skill.name}
                                secondary={`Importance: ${skill.importance}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Experience Analysis */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Experience Analysis
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      Average Tenure: {result.experience.averageTenure}
                    </Typography>
                    {result.experience.gaps.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" color="warning.main" gutterBottom>
                          Employment Gaps
                        </Typography>
                        <List dense>
                          {result.experience.gaps.map((gap, index) => (
                            <ListItem key={index}>
                              <ListItemText
                                primary={gap.period}
                                secondary={`Duration: ${gap.duration}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Box>

                  {/* Screening Questions */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Recommended Screening Questions
                    </Typography>
                    <List>
                      {result.screeningQuestions.map((question, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={`${index + 1}. ${question}`} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Paper>
              </Grid>

              {/* AI Chat Section */}
              <Grid item xs={12} md={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: "#f5f5f5", height: "100%" }}>
                  <Typography variant="h6" gutterBottom>
                    AI Assistant
                  </Typography>
                  <Box sx={{ 
                    height: "calc(100% - 120px)", 
                    overflowY: "auto", 
                    mb: 2,
                    p: 1,
                    bgcolor: "white",
                    borderRadius: 1
                  }}>
                    {chatMessages.map((message, index) => (
                      <Box
                        key={index}
                        sx={{
                          mb: 2,
                          p: 1,
                          bgcolor: message.role === 'assistant' ? '#e3f2fd' : '#f5f5f5',
                          borderRadius: 1,
                          maxWidth: '80%',
                          ml: message.role === 'assistant' ? 0 : 'auto',
                          mr: message.role === 'assistant' ? 'auto' : 0,
                        }}
                      >
                        <Typography variant="body2">
                          {message.content}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <form onSubmit={handleChatSubmit}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={chatInput}
                        onChange={handleChatInputChange}
                        placeholder="Ask about the match..."
                        variant="outlined"
                      />
                      <IconButton 
                        type="submit" 
                        color="primary"
                        disabled={!chatInput.trim()}
                      >
                        <SendIcon />
                      </IconButton>
                    </Box>
                  </form>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
