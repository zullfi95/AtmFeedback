import axios from 'axios';
import { isTokenExpired } from '../utils/tokenUtils';

// Get base URL from environment or use default
const API_URL = import.meta.env.VITE_API_URL || '/feedbackatm/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add interceptor to include auth token in requests and check expiration
api.interceptors.request.use(async (config) => {
  // Получаем токен из localStorage (fallback для Authorization header)
  // HttpOnly cookies (mint_session) автоматически отправляются браузером с withCredentials: true
  let token: string | null = localStorage.getItem('mintstudio_token');
  
  // Проверяем, не истек ли токен
  if (token && isTokenExpired(token)) {
    console.log('🔄 [FeedbackATM API] Token expired, refreshing...');
    // Токен истек или скоро истечет, пытаемся обновить через MintAuth
    try {
      console.log('🔄 [FeedbackATM API] Calling /mintauth/api/auth/refresh...');
      const refreshResponse = await axios.post('/mintauth/api/auth/refresh', {}, {
        withCredentials: true, // Важно для отправки mint_refresh cookie
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ [FeedbackATM API] Refresh response:', refreshResponse.data);

      // MintAuth refresh устанавливает новый токен в HttpOnly cookie и возвращает его в body
      // Используем токен из ответа для Authorization header
      // HttpOnly cookie будет автоматически отправляться браузером в последующих запросах
      if (refreshResponse.data?.access_token) {
        token = refreshResponse.data.access_token;
        localStorage.setItem('mintstudio_token', token); // Сохраняем для Authorization header
        console.log('✅ [FeedbackATM API] New token saved from response (HttpOnly cookie set automatically)');
      } else {
        console.warn('⚠️ [FeedbackATM API] No access_token in refresh response - relying on HttpOnly cookie');
      }
    } catch (refreshError: any) {
      // Если refresh не удался, очищаем localStorage и перенаправляем на логин
      // HttpOnly cookies управляются сервером и будут удалены при следующем запросе
      console.error('❌ [FeedbackATM API] Token refresh failed:', refreshError);
      console.error('❌ [FeedbackATM API] Refresh error response:', refreshError.response?.data);
      console.error('❌ [FeedbackATM API] Refresh error status:', refreshError.response?.status);
      localStorage.removeItem('mintstudio_token');
      localStorage.removeItem('mintstudio_refresh_token');
      window.location.href = '/';
      return Promise.reject(refreshError);
    }
  }
  
  if (token) {
    console.log('🔑 [FeedbackATM API] Using token for request:', config.url);
  } else {
    console.warn('⚠️ [FeedbackATM API] No token available for request:', config.url);
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Всегда включаем withCredentials для cookies
  config.withCredentials = true;
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401 errors with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors with automatic token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Пытаемся обновить токен через MintAuth refresh endpoint
        // Fallback: если cookies нет, отправляем refresh_token из localStorage
        const refreshToken = localStorage.getItem('mintstudio_refresh_token');
        const refreshBody = refreshToken ? { refresh_token: refreshToken } : {};
        const refreshResponse = await axios.post('/mintauth/api/auth/refresh', refreshBody, {
          withCredentials: true, // Для отправки mint_refresh cookie
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // MintAuth refresh возвращает токены в body и устанавливает в HttpOnly cookies
        const newToken = refreshResponse.data?.access_token;
        const newRefreshToken = refreshResponse.data?.refresh_token;
        if (newRefreshToken) {
          localStorage.setItem('mintstudio_refresh_token', newRefreshToken);
        }
        
        // Повторяем оригинальный запрос
        // Если есть новый токен, добавляем в Authorization header
        // HttpOnly cookie будет отправлен автоматически браузером
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          localStorage.setItem('mintstudio_token', newToken);
        }
        originalRequest.withCredentials = true;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh не удался - разлогиниваем
        localStorage.removeItem('mintstudio_token');
        // HttpOnly cookies управляются сервером
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: any, config?: any) => api.post('/auth/login', credentials, {
    withCredentials: true, // Важно для получения cookies от MintAuth
    ...config,
  }),
  me: () => api.get('/auth/me'),
  verify: () => api.get('/auth/verify'),
};

// Admin API
export const adminAPI = {
  // Users
  getUsers: () => api.get('/admin/users'),
  createUser: (userData: any) => api.post('/admin/users', userData),
  updateUser: (id: string, userData: any) => api.put(`/admin/users/${id}`, userData),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  assignPointsToCleaner: (userId: string, pointIds: string[]) => 
    api.post(`/admin/users/${userId}/assign-points`, { pointIds }),
  getAssignedPoints: (userId: string) => api.get(`/admin/users/${userId}/assigned-points`),
  
  // Companies
  getCompanies: () => api.get('/admin/companies'),
  createCompany: (companyData: any) => api.post('/admin/companies', companyData),
  updateCompany: (id: string, companyData: any) => api.put(`/admin/companies/${id}`, companyData),
  deleteCompany: (id: string) => api.delete(`/admin/companies/${id}`),
  
  // Service Points (generalized ATMs)
  getServicePoints: () => api.get('/admin/service-points'),
  createServicePoint: (pointData: any) => api.post('/admin/service-points', pointData),
  updateServicePoint: (id: string, pointData: any) => api.put(`/admin/service-points/${id}`, pointData),
  deleteServicePoint: (id: string) => api.delete(`/admin/service-points/${id}`),

  // Backwards compatibility/Transition (optional, but good for now)
  getATMs: () => api.get('/admin/service-points'),
  createATM: (pointData: any) => api.post('/admin/service-points', pointData),
  updateATM: (id: string, pointData: any) => api.put(`/admin/service-points/${id}`, pointData),
  deleteATM: (id: string) => api.delete(`/admin/service-points/${id}`),
  assignATMsToCleaner: (userId: string, atmIds: string[]) => 
    api.post(`/admin/users/${userId}/assign-points`, { pointIds: atmIds }),

  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard-stats'),
};

// Manager API
export const managerAPI = {
  getTasks: () => api.get('/manager/tasks'),
  createTask: (taskData: any) => api.post('/manager/tasks', taskData),
  updateTask: (id: string, taskData: any) => api.put(`/manager/tasks/${id}`, taskData),
  deleteTask: (id: string) => api.delete(`/manager/tasks/${id}`),
  addComment: (id: string, managerNotes: string) => api.put(`/manager/tasks/${id}/comment`, { managerNotes }),
  getServicePoints: () => api.get('/manager/service-points'),
  getCleaners: () => api.get('/manager/cleaners'),
  getStats: () => api.get('/manager/stats'),
  getDashboardStats: () => api.get('/manager/dashboard-stats'),
  exportTasks: (format: 'excel' | 'csv' = 'excel') =>
    api.get(`/manager/tasks/export?format=${format}`, { responseType: 'blob' }),

  // Маршруты: группировка объектов и назначение клинера
  getRoutes: () => api.get('/manager/routes'),
  createRoute: (data: { name: string; cleanerId: string; servicePointIds: string[] }) =>
    api.post('/manager/routes', data),
  updateRoute: (id: string, data: { name?: string; cleanerId?: string; servicePointIds?: string[] }) =>
    api.put(`/manager/routes/${id}`, data),
  deleteRoute: (id: string) => api.delete(`/manager/routes/${id}`),

  getATMs: () => api.get('/manager/service-points'),
};

// Cleaner API
export const cleanerAPI = {
  getTasks: () => api.get('/cleaner/tasks'),
  startTask: (id: string) => api.put(`/cleaner/tasks/${id}/start`),
  completeTask: (id: string, data: { notes?: string; photoBefore?: File; photoAfter?: File; photoDamage?: File }) => {
    const formData = new FormData();
    if (data.notes) formData.append('notes', data.notes);
    if (data.photoBefore) formData.append('photoBefore', data.photoBefore);
    if (data.photoAfter) formData.append('photoAfter', data.photoAfter);
    if (data.photoDamage) formData.append('photoDamage', data.photoDamage);
    return api.put(`/cleaner/tasks/${id}/complete`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getHistory: () => api.get('/cleaner/history'),
  getAssignedPoints: () => api.get('/cleaner/assigned-points'),
  getMyRoute: () => api.get('/cleaner/my-route'),

  // Backwards compatibility
  getAssignedATMs: () => api.get('/cleaner/assigned-points'),
};

export default api;
