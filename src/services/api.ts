import axios from 'axios';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

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
  login: (credentials: any) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  setupInitial: (data: any) => api.post('/api/auth/setup-initial', data),
};

export const schoolService = {
  list: () => api.get('/api/v1/schools'),
  create: (data: any) => api.post('/api/v1/schools', data),
  update: (id: string, data: any) => api.put(`/api/v1/schools/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/schools/${id}`),
};

export const studentService = {
  list: () => api.get('/api/v1/students'),
  create: (data: any) => api.post('/api/v1/students', data),
  update: (id: string, data: any) => api.put(`/api/v1/students/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/students/${id}`),
};

export const teacherService = {
  list: () => api.get('/api/v1/teachers'),
  create: (data: any) => api.post('/api/v1/teachers', data),
  update: (id: string, data: any) => api.put(`/api/v1/teachers/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/teachers/${id}`),
};

export const classService = {
  list: () => api.get('/api/v1/classes'),
  create: (data: any) => api.post('/api/v1/classes', data),
  update: (id: string, data: any) => api.put(`/api/v1/classes/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/classes/${id}`),
};

export const subjectService = {
  list: () => api.get('/api/v1/subjects'),
  create: (data: any) => api.post('/api/v1/subjects', data),
  update: (id: string, data: any) => api.put(`/api/v1/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/subjects/${id}`),
};

export const resultService = {
  list: (params?: any) => api.get('/api/v1/results', { params }),
  create: (data: any) => api.post('/api/v1/results', data),
  update: (id: string, data: any) => api.put(`/api/v1/results/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/results/${id}`),
};

export const sessionService = {
  list: () => api.get('/api/v1/sessions'),
  create: (data: any) => api.post('/api/v1/sessions', data),
  update: (id: string, data: any) => api.put(`/api/v1/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/sessions/${id}`),
};

export const dashboardService = {
  getStats: () => api.get('/api/v1/dashboard-stats'),
};

export const fileService = {
  upload: (file: File, folder: string = 'uploads', onProgress?: (p: number) => void) => {
    return new Promise<{ data: { url: string } }>((resolve, reject) => {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        return reject(new Error('File size exceeds 2MB limit.'));
      }

      // Generate unique filename
      const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, `${folder}/${filename}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Firebase Storage Error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ data: { url: downloadURL } });
        }
      );
    });
  }
};
