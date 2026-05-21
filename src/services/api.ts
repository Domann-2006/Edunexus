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
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // Ignore storage issues
  }
  return config;
});

// Response interceptor to catch "Login Page instead of JSON" issues and Auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized access - potential expired or invalid token. Redirecting to login.');
      // Remove local auth data
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      // Force page reload to trigger App.tsx internal states and redirect to /login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
      console.error('API Error: Received HTML instead of JSON. This usually indicates a routing mismatch or fall-through to SPA catch-all.');
      return Promise.reject(new Error('Server configuration error: Received HTML instead of JSON.'));
    }
    return Promise.reject(error);
  }
);

export default api;

// --- CLIENT-SIDE INSTANT CACHE FOR HIGH-PERFORMANCE ROUTE TRANSITIONS ---
const clientCache = new Map<string, { data: any; expires: number }>();

const originalGet = api.get;
api.get = function (url: string, config?: any) {
  const isCacheable = url.includes('/v1/') && !url.includes('/chats') && !url.includes('/tickets');
  
  if (!isCacheable || config?.bypassCache) {
    return originalGet.call(this, url, config);
  }
  
  const cacheKey = url + JSON.stringify(config?.params || {});
  const now = Date.now();
  const cached = clientCache.get(cacheKey);
  
  if (cached && cached.expires > now) {
    console.debug(`[CLIENT CACHE HIT] Returning sub-millisecond cached state for route ${url}`);
    return Promise.resolve(cached.data);
  }
  
  return originalGet.call(this, url, config).then((response) => {
    if (response && response.status === 200) {
      // Cache lists for 12 seconds to provide blistering fast dashboard navigation
      clientCache.set(cacheKey, { data: response, expires: Date.now() + 12000 });
    }
    return response;
  });
};

// Response Interceptor to automatically invalidate relevant cache scopes upon write operations
api.interceptors.response.use(
  (response) => {
    const config = response.config;
    if (config?.method && ['post', 'put', 'delete'].includes(config.method.toLowerCase())) {
      const url = config.url || '';
      const segments = url.split('/');
      // e.g. /v1/students from /v1/students/someId
      const baseResource = segments.slice(0, 3).join('/'); 
      
      console.debug(`[CLIENT MUTATION DETECTED] Invalidating cache prefix: ${baseResource}`);
      for (const key of clientCache.keys()) {
        if (key.includes(baseResource) || key.includes(url)) {
          clientCache.delete(key);
        }
      }
      
      // Also invalidate stats dashboard data
      for (const key of clientCache.keys()) {
        if (key.includes('/v1/dashboard-stats') || key.includes('subscriptions')) {
          clientCache.delete(key);
        }
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
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
  bulkCreate: (data: any) => api.post('/v1/subjects/bulk', data),
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

export const attendanceService = {
  list: (params?: any) => api.get('/v1/attendance', { params }),
  create: (data: any) => api.post('/v1/attendance', data),
  bulkCreate: (records: any[]) => Promise.all(records.map(r => api.post('/v1/attendance', r))),
  update: (id: string, data: any) => api.put(`/v1/attendance/${id}`, data),
  delete: (id: string) => api.delete(`/v1/attendance/${id}`),
};

export const activityService = {
  list: (params?: any) => api.get('/v1/activity-logs', { params }),
};

export const ticketService = {
  list: (params?: any) => api.get('/v1/tickets', { params }),
  create: (data: any) => api.post('/v1/tickets', data),
  update: (id: string, data: any) => api.put(`/v1/tickets/${id}`, data),
  delete: (id: string) => api.delete(`/v1/tickets/${id}`),
};

export const announcementService = {
  list: (params?: any) => api.get('/v1/announcements', { params }),
  create: (data: any) => api.post('/v1/announcements', data),
  update: (id: string, data: any) => api.put(`/v1/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/v1/announcements/${id}`),
};

export const subscriptionService = {
  getStats: () => api.get('/v1/subscriptions/stats'),
  getMySubscription: () => api.get('/v1/subscriptions/my'),
};

export const chatService = {
  list: () => api.get('/v1/chats'),
  getMessages: (chatId: string) => api.get(`/v1/chats/${chatId}/messages`),
  sendMessage: (chatId: string, text: string) => api.post(`/v1/chats/${chatId}/messages`, { text }),
};

export const platformSettingsService = {
  get: () => api.get('/v1/platform-settings'),
  update: (data: any) => api.post('/v1/platform-settings', data),
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
