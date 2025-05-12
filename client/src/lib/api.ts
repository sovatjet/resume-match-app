// API Client Configuration
const API_BASE_URL = 'https://resume-match-backend.onrender.com';

// API Client
export const apiClient = {
  async matchResume(formData: FormData) {
    const url = `${API_BASE_URL}/api/match`;
    console.log('API Client - Match Request:', {
      url,
      files: {
        resume: formData.get('resume') instanceof File ? (formData.get('resume') as File).name : 'unknown',
        jobDesc: formData.get('jobDesc') instanceof File ? (formData.get('jobDesc') as File).name : 'unknown'
      }
    });

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors'
    });

    console.log('API Client - Response:', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('API Client - Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`Match request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async chat(message: string, matchResult: any) {
    const url = `${API_BASE_URL}/api/chat`;
    console.log('API Client - Chat Request:', {
      url,
      message
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({
        message,
        matchResult
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('API Client - Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}; 