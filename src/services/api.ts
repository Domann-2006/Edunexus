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
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        console.warn('Unauthorized access - potential expired or invalid token. Redirecting to login.');
        // Remove local auth data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        // Force page reload to trigger App.tsx internal states and redirect to /login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
      console.error('API Error: Received HTML instead of JSON. This usually indicates a routing mismatch or fall-through to SPA catch-all.');
      return Promise.reject(new Error('Server configuration error: Received HTML instead of JSON.'));
    }
    return Promise.reject(error);
  }
);

// --- INTUITIVE LIGHTWEIGHT EVENT BUS FOR OFFLINE SYNC EXPLOITS ---
type CacheCallback = (cacheKey: string, data: any) => void;
class CacheEventEmitter {
  private listeners = new Set<CacheCallback>();
  subscribe(cb: CacheCallback) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }
  emit(cacheKey: string, data: any) {
    this.listeners.forEach(cb => {
      try { cb(cacheKey, data); } catch (e) { /* ignore */ }
    });
  }
}
export const cacheEvents = new CacheEventEmitter();

const clientCache = new Map<string, { data: any; timestamp: number }>();

// Restore Cache slots from LocalStorage
try {
  const savedCache = localStorage.getItem('edunexus_client_cache');
  if (savedCache) {
    const parsed = JSON.parse(savedCache);
    Object.keys(parsed).forEach(key => {
      clientCache.set(key, parsed[key]);
    });
    console.log('[CACHE] Restored cache slots from storage:', clientCache.size);
  }
} catch (e) {
  console.warn('Failed to restore API cache from local storage:', e);
}

function persistCacheToLocalStorage() {
  try {
    const backup: Record<string, any> = {};
    const keysArray = Array.from(clientCache.keys());
    // Cap to 120 slots to keep local storage clean and performant
    const recentKeys = keysArray.slice(-120);
    recentKeys.forEach(key => {
      backup[key] = clientCache.get(key);
    });
    localStorage.setItem('edunexus_client_cache', JSON.stringify(backup));
  } catch (e) {
    console.warn('Could not persist cache to storage:', e);
  }
}

// --- OPTIMISTIC QUEUE FOR UNINTERRUPTED FLUID ACTIONS ---
export interface OfflineMutation {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  timestamp: number;
}

export let offlineQueue: OfflineMutation[] = [];

try {
  const savedQueue = localStorage.getItem('edunexus_offline_queue');
  if (savedQueue) {
    offlineQueue = JSON.parse(savedQueue);
    console.log('[SYNC] Loaded pending offline actions:', offlineQueue.length);
  }
} catch (e) {
  console.warn('Failed to load local offline queue:', e);
}

export function saveQueueToLocalStorage() {
  try {
    localStorage.setItem('edunexus_offline_queue', JSON.stringify(offlineQueue));
  } catch (e) {
    console.warn('Failed to write offline action queue:', e);
  }
}

// Perform optimistic GET cache inline modifications
function applyOptimisticUpdatesToCache(method: string, url: string, payload: any) {
  // Find resource context (e.g. /v1/students)
  const segments = url.split('/');
  const baseResource = segments.slice(0, 3).join('/'); // /v1/resourceName
  
  console.log(`[OPTIMISTIC] Altering cache for base resource: ${baseResource}`);

  for (const cacheKey of clientCache.keys()) {
    if (!cacheKey.includes(baseResource)) continue;

    const entry = clientCache.get(cacheKey);
    if (!entry || !Array.isArray(entry.data)) continue;

    let items = [...entry.data];

    if (method === 'POST') {
      const isDuplicate = items.some((item: any) => item.id === payload.id || item.admissionNumber === payload.admissionNumber);
      if (!isDuplicate) {
        items.unshift({
          ...payload,
          id: payload.id || `temp-${Date.now()}`,
          isPendingSync: true,
          createdAt: new Date().toISOString()
        });
      }
    } else if (method === 'PUT') {
      const matchId = segments[3] || payload.id;
      items = items.map((item: any) => 
        (item.id === matchId || item.id === payload.id) ? { ...item, ...payload, isPendingSync: true } : item
      );
    } else if (method === 'DELETE') {
      const matchId = segments[3];
      items = items.filter((item: any) => item.id !== matchId);
    }

    clientCache.set(cacheKey, { data: items, timestamp: Date.now() });
    console.log(`[OPTIMISTIC] Cache slot updated successfully: ${cacheKey}`);
  }

  persistCacheToLocalStorage();
  cacheEvents.emit('cache_updated', { resource: baseResource, isOptimistic: true });
}

// Intercept AXIOS GET requests with offline cache & silent background verification
const originalGet = api.get;
api.get = function (url: string, config?: any) {
  const isCacheable = url.includes('/v1/') && !url.includes('/chats') && !url.includes('/tickets');
  
  if (!isCacheable || config?.bypassCache) {
    return originalGet.call(this, url, config);
  }
  
  const cacheKey = url + JSON.stringify(config?.params || {});
  const cached = clientCache.get(cacheKey);
  
  if (cached) {
    // Schedule SILENT background fetch so visual loading states are COMPLETELY bypassed
    setTimeout(() => {
      if (navigator.onLine === false) return; // ignore background check if offline

      originalGet.call(api, url, { ...config, bypassCache: true })
        .then((freshResponse) => {
          if (freshResponse && freshResponse.status === 200) {
            const hasChanged = JSON.stringify(cached.data) !== JSON.stringify(freshResponse.data);
            if (hasChanged) {
              console.log(`[SILENT REFRESH] Content changed for ${url}. Re-loading listeners!`);
              clientCache.set(cacheKey, { data: freshResponse.data, timestamp: Date.now() });
              persistCacheToLocalStorage();
              // Emit event so subscribers silently updates on-screen matrices
              cacheEvents.emit(cacheKey, freshResponse);
              cacheEvents.emit('cache_updated', { resource: url, isOptimistic: false });
            }
          }
        })
        .catch((err) => {
          console.debug('[SILENT REFRESH] Background check failed silently (offline/network issue). Retention remains safe.');
        });
    }, 100);

    // Resolve immediately with Axios-compatible return node
    const axiosMockResponse = {
      data: cached.data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { url, ...config } as any
    };
    return Promise.resolve(axiosMockResponse);
  }
  
  return originalGet.call(this, url, config).then((response) => {
    if (response && response.status === 200) {
      clientCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      persistCacheToLocalStorage();
    }
    return response;
  });
};

// Intercept AXIOS write mutations (POST, PUT, DELETE) and provide offline reliability
const originalPost = api.post;
api.post = function (url: string, data?: any, config?: any) {
  const isCachableResource = url.includes('/v1/');
  
  if (!isCachableResource || navigator.onLine) {
    return originalPost.call(this, url, data, config).then((res) => {
      if (isCachableResource) {
        applyOptimisticUpdatesToCache('POST', url, res.data || data);
      }
      return res;
    }).catch((err) => {
      // Catch network failure to support automatic offline queueing
      const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message === 'Network Error';
      if (isCachableResource && isNetworkError) {
        console.warn(`[OFFLINE FORCE] POST ${url} failed due to network. Adding to background sync queue...`);
        const optimisticId = `temp-${Date.now()}`;
        const queuedAction: OfflineMutation = {
          id: optimisticId,
          method: 'POST',
          url,
          data: { ...data, id: optimisticId },
          timestamp: Date.now()
        };
        offlineQueue.push(queuedAction);
        saveQueueToLocalStorage();
        applyOptimisticUpdatesToCache('POST', url, queuedAction.data);
        
        // Notify user about offline save
        cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

        return Promise.resolve({
          data: queuedAction.data,
          status: 200,
          statusText: 'OK (Offline Queued)',
          headers: {},
          config: {} as any
        });
      }
      return Promise.reject(err);
    });
  }

  // Pure Offline handler
  console.log(`[OFFLINE] POST ${url} requested. Queueing action.`);
  const optimisticId = `temp-${Date.now()}`;
  const queuedAction: OfflineMutation = {
    id: optimisticId,
    method: 'POST',
    url,
    data: { ...data, id: optimisticId },
    timestamp: Date.now()
  };
  offlineQueue.push(queuedAction);
  saveQueueToLocalStorage();
  applyOptimisticUpdatesToCache('POST', url, queuedAction.data);

  cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

  return Promise.resolve({
    data: queuedAction.data,
    status: 200,
    statusText: 'OK (Offline Queued)',
    headers: {},
    config: {} as any
  });
};

const originalPut = api.put;
api.put = function (url: string, data?: any, config?: any) {
  const isCachableResource = url.includes('/v1/');

  if (!isCachableResource || navigator.onLine) {
    return originalPut.call(this, url, data, config).then((res) => {
      if (isCachableResource) {
        applyOptimisticUpdatesToCache('PUT', url, data);
      }
      return res;
    }).catch((err) => {
      const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message === 'Network Error';
      if (isCachableResource && isNetworkError) {
        console.warn(`[OFFLINE FORCE] PUT ${url} failed. Adding to sync queue...`);
        const queuedAction: OfflineMutation = {
          id: `put-${Date.now()}`,
          method: 'PUT',
          url,
          data,
          timestamp: Date.now()
        };
        offlineQueue.push(queuedAction);
        saveQueueToLocalStorage();
        applyOptimisticUpdatesToCache('PUT', url, data);
        cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

        return Promise.resolve({
          data,
          status: 200,
          statusText: 'OK (Offline Queued)',
          headers: {},
          config: {} as any
        });
      }
      return Promise.reject(err);
    });
  }

  console.log(`[OFFLINE] PUT ${url} requested.`);
  const queuedAction: OfflineMutation = {
    id: `put-${Date.now()}`,
    method: 'PUT',
    url,
    data,
    timestamp: Date.now()
  };
  offlineQueue.push(queuedAction);
  saveQueueToLocalStorage();
  applyOptimisticUpdatesToCache('PUT', url, data);
  cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

  return Promise.resolve({
    data,
    status: 200,
    statusText: 'OK (Offline Queued)',
    headers: {},
    config: {} as any
  });
};

const originalDelete = api.delete;
api.delete = function (url: string, config?: any) {
  const isCachableResource = url.includes('/v1/');

  if (!isCachableResource || navigator.onLine) {
    return originalDelete.call(this, url, config).then((res) => {
      if (isCachableResource) {
        applyOptimisticUpdatesToCache('DELETE', url, null);
      }
      return res;
    }).catch((err) => {
      const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message === 'Network Error';
      if (isCachableResource && isNetworkError) {
        console.warn(`[OFFLINE FORCE] DELETE ${url} failed. Queueing delete...`);
        const queuedAction: OfflineMutation = {
          id: `del-${Date.now()}`,
          method: 'DELETE',
          url,
          timestamp: Date.now()
        };
        offlineQueue.push(queuedAction);
        saveQueueToLocalStorage();
        applyOptimisticUpdatesToCache('DELETE', url, null);
        cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

        return Promise.resolve({
          data: { success: true },
          status: 200,
          statusText: 'OK (Offline Queued)',
          headers: {},
          config: {} as any
        });
      }
      return Promise.reject(err);
    });
  }

  console.log(`[OFFLINE] DELETE ${url} requested.`);
  const queuedAction: OfflineMutation = {
    id: `del-${Date.now()}`,
    method: 'DELETE',
    url,
    timestamp: Date.now()
  };
  offlineQueue.push(queuedAction);
  saveQueueToLocalStorage();
  applyOptimisticUpdatesToCache('DELETE', url, null);
  cacheEvents.emit('sync_status', { status: 'offline_queued', count: offlineQueue.length });

  return Promise.resolve({
    data: { success: true },
    status: 200,
    statusText: 'OK (Offline Queued)',
    headers: {},
    config: {} as any
  });
};

// --- AUTOMATIC BACKGROUND SYNCHRONIZATION POLLER ---
let isOfflineSyncing = false;
export async function synchronizeOfflineQueue() {
  if (isOfflineSyncing || offlineQueue.length === 0) return;
  if (!navigator.onLine) return;

  isOfflineSyncing = true;
  console.log(`[SYNC ENGINE] Synchronizing queue: ${offlineQueue.length} entries. Please wait...`);
  cacheEvents.emit('sync_status', { status: 'syncing', count: offlineQueue.length });

  const remainingActions: OfflineMutation[] = [];

  for (const action of offlineQueue) {
    try {
      if (action.method === 'POST') {
        await originalPost.call(api, action.url, action.data);
      } else if (action.method === 'PUT') {
        await originalPut.call(api, action.url, action.data);
      } else if (action.method === 'DELETE') {
        await originalDelete.call(api, action.url);
      }
      console.log(`[SYNC SUCCESS] Executed action: ${action.method} ${action.url}`);
    } catch (err: any) {
      console.error(`[SYNC FAILURE] Action failed: ${action.method} ${action.url}`, err);
      // If it's a validation error or user unauthorized, drop the sync element to prevent loop blocks
      const isValidationOrPermissionsError = err.response && (err.response.status === 400 || err.response.status === 403 || err.response.status === 422);
      if (!isValidationOrPermissionsError) {
        remainingActions.push(action); // retry later
      }
    }
  }

  offlineQueue = remainingActions;
  saveQueueToLocalStorage();
  isOfflineSyncing = false;

  // Clear cache completely to fetch clean state on sync completion
  clientCache.clear();
  persistCacheToLocalStorage();

  console.log(`[SYNC COMPLETE] Remaining queued tasks: ${offlineQueue.length}`);
  cacheEvents.emit('sync_status', { status: offlineQueue.length === 0 ? 'completed' : 'partially_failed', count: offlineQueue.length });
  cacheEvents.emit('sync_completed', null);
}

// Attach network change listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[NETWORK] Connection restored. Firing synchronization loop...');
    synchronizeOfflineQueue();
  });
  window.addEventListener('offline', () => {
    console.log('[NETWORK] Connection interrupted.');
    cacheEvents.emit('sync_status', { status: 'offline', count: offlineQueue.length });
  });

  // Schedule cron worker check every 15 seconds
  setInterval(() => {
    if (navigator.onLine && offlineQueue.length > 0) {
      synchronizeOfflineQueue();
    }
  }, 15000);
}

export default api;

export const authService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  setupInitial: (data: any) => api.post('/auth/setup-initial', data),
  getSetupStatus: () => api.get('/auth/setup-status'),
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
