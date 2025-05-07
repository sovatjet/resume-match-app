export const API_CONFIG = {
  baseUrl: 'https://resume-match-backend.onrender.com',
  endpoints: {
    match: '/api/match',
    chat: '/api/chat'
  }
} as const;

export const getApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
}; 