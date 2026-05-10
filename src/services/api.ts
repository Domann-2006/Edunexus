import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

if (import.meta.env.PROD && (!import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL === '/api')) {
  console.warn('VITE_API_URL is not set to an absolute URL in production. Relative paths (/api) will only work if the frontend is served from the same domain as the backend.');
}

console.log('API Client initialized with baseURL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add token from localStorage if present (though we use cookies mostly)
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // Ignore storage issues
  }
  return config;
});

// Response interceptor to catch "Login Page instead of JSON" issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
      console.error('API Error: Received HTML instead of JSON. This usually indicates a routing mismatch or fall-through to SPA catch-all.');
      return Promise.reject(new Error('Server configuration error: Received HTML instead of JSON.'));
    }
    return Promise.reject(error);
  }
);

export default api;

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  setupInitial: (data: any) => api.post('/auth/setup-initial', data),
};

export const schoolService = {
  list: (params?: any) => api.get('/v1/schools', { params }),
  create: (data: any) => api.post('/v1/schools', data),
  update: (id: string, data: any) => api.put(`/v1/schools/${id}`, data),
  delete: (id: string) => api.delete(`/v1/schools/${id}`),
};

export const studentService = {
  list: (params?: any) => api.get('/v1/students', { params }),
  create: (data: any) => api.post('/v1/students', data),
  update: (id: string, data: any) => api.put(`/v1/students/${id}`, data),
  delete: (id: string) => api.delete(`/v1/students/${id}`),
};

export const teacherService = {
  list: (params?: any) => api.get('/v1/teachers', { params }),
  create: (data: any) => api.post('/v1/teachers', data),
  update: (id: string, data: any) => api.put(`/v1/teachers/${id}`, data),
  delete: (id: string) => api.delete(`/v1/teachers/${id}`),
};

export const classService = {
  list: (params?: any) => api.get('/v1/classes', { params }),
  create: (data: any) => api.post('/v1/classes', data),
  update: (id: string, data: any) => api.put(`/v1/classes/${id}`, data),
  delete: (id: string) => api.delete(`/v1/classes/${id}`),
};

export const subjectService = {
  list: (params?: any) => api.get('/v1/subjects', { params }),
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
  list: (params?: any) => api.get('/v1/sessions', { params }),
  create: (data: any) => api.post('/v1/sessions', data),
  update: (id: string, data: any) => api.put(`/v1/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/v1/sessions/${id}`),
};

export const dashboardService = {
  getStats: (params?: any) => api.get('/v1/dashboard-stats', { params }),
};

export const fileService = {
  upload: async (file: File, folder: string = 'uploads', onProgress?: (p: number) => void) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    // Temporary debugging logs as requested
    console.log('Cloudinary Config:', { cloudName, uploadPreset });

    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary configuration is missing. Please check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `edunexus/${folder}`);

    try {
      // Note: native fetch doesn't support onUploadProgress easily without XHR.
      // We'll use axios for progress support or just skip progress if fetch is strictly required.
      // The user snippet uses fetch, but they also want progress indicators.
      // I'll use axios to the Cloudinary URL to keep progress working perfectly.
      
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(progress);
            }
          },
        }
      );

      return { data: { url: response.data.secure_url } };
    } catch (err: any) {
      console.error('Cloudinary Upload Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.message || 'Upload to Cloudinary failed');
    }
  }
};
