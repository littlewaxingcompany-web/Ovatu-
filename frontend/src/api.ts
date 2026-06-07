import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const email = localStorage.getItem('user_email');
  const isAuthenticated = localStorage.getItem('is_authenticated') === 'true';
  
  if (email) {
    config.headers['X-User-Email'] = email;
  }
  
  return config;
});

export default api;
