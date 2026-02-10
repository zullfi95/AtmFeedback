import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  role: string;
  companyId?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Явные логи для диагностики
    console.log('=== FeedbackATM useAuth useEffect START ===');
    console.log('[FeedbackATM] useAuth useEffect triggered');
    console.log('[FeedbackATM] Current URL:', window.location.href);
    
    // Проверяем localStorage для fallback (если HttpOnly cookies недоступны)
    const token = localStorage.getItem('mintstudio_token');
    if (token) {
      console.log('[FeedbackATM] Token found in localStorage (fallback), length:', token.length);
    } else {
      console.log('[FeedbackATM] No token in localStorage - will verify via API (HttpOnly cookies handled automatically)');
    }

    // Всегда пытаемся проверить токен через API
    // API автоматически использует HttpOnly cookies (mint_session), если они установлены
    // Backend вернет 401, если сессия недействительна, и мы обработаем это правильно
    console.log('[FeedbackATM] Calling verifyToken...');
    verifyToken();
    console.log('=== FeedbackATM useAuth useEffect END ===');
  }, []);

  const verifyToken = async () => {
    try {
      console.log('[FeedbackATM] verifyToken START');
      console.log('[FeedbackATM] Verifying session via API (HttpOnly cookies handled automatically by browser)');
      console.log('[FeedbackATM] Making API request to /auth/verify');
      
      const response = await api.get('/auth/verify');
      
      console.log('[FeedbackATM] Verify response received');
      console.log('[FeedbackATM] Response status:', response.status);
      console.log('[FeedbackATM] Response data:', response.data);
      
      // Backend may return {user} or {admin} depending on compatibility
      const userData = response.data.user || response.data.admin;
      console.log('[FeedbackATM] User data extracted:', userData);
      console.log('[FeedbackATM] Setting user...');
      setUser(userData);
      console.log('[FeedbackATM] User set successfully - session verified');
    } catch (error: any) {
      console.error('[FeedbackATM] Verify error occurred');
      console.error('[FeedbackATM] Error:', error);
      console.error('[FeedbackATM] Error message:', error.message);
      console.error('[FeedbackATM] Error response:', error.response?.data);
      console.error('[FeedbackATM] Error status:', error.response?.status);
      console.error('[FeedbackATM] Error config:', error.config?.url);
      
      // Очищаем localStorage при ошибке (HttpOnly cookies управляются сервером)
      console.log('[FeedbackATM] Clearing localStorage tokens...');
      localStorage.removeItem('mintstudio_token');
      localStorage.removeItem('feedbackatm_token');
      setUser(null);
      console.log('[FeedbackATM] Tokens cleared, user set to null');
    } finally {
      console.log('[FeedbackATM] verifyToken FINALLY - setting loading to false');
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Вызываем локальный endpoint, который проксирует на MintAuth
      // withCredentials: true важно для получения cookies от MintAuth
      const response = await api.post('/auth/login', { username, password }, {
        withCredentials: true,
      });
      
      // Fallback: сохраняем токены в localStorage, если cookies не установились
      const accessToken = response.data?.access_token;
      const refreshToken = response.data?.refresh_token;
      if (accessToken) {
        localStorage.setItem('mintstudio_token', accessToken);
      }
      if (refreshToken) {
        localStorage.setItem('mintstudio_refresh_token', refreshToken);
      }

      // После успешного логина, токен будет в cookie mint_session
      // Проверяем токен для получения информации о пользователе
      await verifyToken();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = async () => {
    // Всегда вызываем централизованный logout через MintAuth
    // MintAuth удалит HttpOnly cookies автоматически
    try {
      await fetch('/mintauth/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Очищаем localStorage (HttpOnly cookies управляются сервером)
    localStorage.removeItem('mintstudio_token');
    localStorage.removeItem('feedbackatm_token');
    localStorage.removeItem('mintstudio_refresh_token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
