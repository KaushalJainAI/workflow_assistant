/**
 * API Client Configuration
 * 
 * Central axios instance with interceptors for auth, error handling, and refresh.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
export const tokenManager = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  
  setTokens: (access: string, refresh: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  
  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  
  isAuthenticated: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || '';
    
    // Check if this is an auth endpoint (login, register, etc.) - don't redirect on 401 for these
    const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                           requestUrl.includes('/auth/register') ||
                           requestUrl.includes('/auth/refresh');
    
    // Handle 401 - try to refresh token (but not for auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        tokenManager.clearTokens();
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });
        
        const { access } = response.data;
        tokenManager.setTokens(access, refreshToken);
        processQueue(null, access);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        tokenManager.clearTokens();
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    const errorMessage = (error.response?.data as { detail?: string })?.detail || error.message;
    return Promise.reject(new Error(errorMessage));
  }
);

export default apiClient;

// Helper for API errors
export interface ApiError {
  message: string;
  status?: number;
  details?: Record<string, string[]>;
}

export function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    return {
      message: (error.response?.data as { detail?: string })?.detail || error.message,
      status: error.response?.status,
      details: (error.response?.data as { errors?: Record<string, string[]> })?.errors,
    };
  }
  return { message: String(error) };
}
