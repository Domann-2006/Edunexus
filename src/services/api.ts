import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add token from localStorage if present (though we use cookies mostly)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  setupInitial: (data: any) => api.post('/auth/setup-initial', data),
};

export const schoolService = {
  list: () => api.get('/v1/schools'),
  create: (data: any) => api.post('/v1/schools', data),
  update: (id: string, data: any) => api.put(`/v1/schools/${id}`, data),
  delete: (id: string) => api.delete(`/v1/schools/${id}`),
};

export const studentService = {
  list: () => api.get('/v1/students'),
  create: (data: any) => api.post('/v1/students', data),
  update: (id: string, data: any) => api.put(`/v1/students/${id}`, data),
  delete: (id: string) => api.delete(`/v1/students/${id}`),
};

export const teacherService = {
  list: () => api.get('/v1/teachers'),
  create: (data: any) => api.post('/v1/teachers', data),
  update: (id: string, data: any) => api.put(`/v1/teachers/${id}`, data),
  delete: (id: string) => api.delete(`/v1/teachers/${id}`),
};

export const classService = {
  list: () => api.get('/v1/classes'),
  create: (data: any) => api.post('/v1/classes', data),
  update: (id: string, data: any) => api.put(`/v1/classes/${id}`, data),
  delete: (id: string) => api.delete(`/v1/classes/${id}`),
};

export const subjectService = {
  list: () => api.get('/v1/subjects'),
  create: (data: any) => api.post('/v1/subjects', data),
  update: (id: string, data: any) => api.put(`/v1/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/v1/subjects/${id}`),
};

export const resultService = {
  list: (params?: any) => api.get('/v1/results', { params }),
  create: (data: any) => api.post('/v1/results', data),
  update: (id: string, data: any) => api.put(`/v1/results/${id}`, data),
  delete: (id: string) => api.delete(`/v1/results/${id}`),
};

export const sessionService = {
  list: () => api.get('/v1/sessions'),
  create: (data: any) => api.post('/v1/sessions', data),
  update: (id: string, data: any) => api.put(`/v1/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/v1/sessions/${id}`),
};

export const dashboardService = {
  getStats: () => api.get('/v1/dashboard-stats'),
};
