/**
 * Authentication Service
 * 
 * Handles login, register, logout, and user profile.
 */

import apiClient, { tokenManager } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  credits: number;
  createdAt: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export const authService = {
  /**
   * Login with Google
   */
  async googleLogin(code: string): Promise<AuthResponse> {
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
    try {
      const response = await apiClient.post<AuthResponse>('/auth/google/', { 
        code,
        redirect_uri: redirectUri
      });
      const { access, refresh } = response.data;
      tokenManager.setTokens(access, refresh);
      return response.data;
    } catch (error) {
       console.error("Google login error", error);
       throw error;
    }
  },

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login/', {
        username: credentials.email, // Django uses username for auth
        password: credentials.password,
      });
      const { access, refresh } = response.data;
      tokenManager.setTokens(access, refresh);
      return response.data;
    } catch (error) {
      // Check if it's an axios error with a 401 status
      if (error instanceof Error && error.message) {
        // The apiClient interceptor converts errors - check the underlying cause
        const axiosError = (error as { response?: { status: number } });
        if (axiosError.response?.status === 401) {
          throw new Error('Invalid email or password. Please try again.');
        }
      }
      // For 401, the message from backend might be "No active account found with the given credentials"
      // or similar - let's make it more user-friendly
      if (error instanceof Error && 
          (error.message.toLowerCase().includes('credentials') || 
           error.message.toLowerCase().includes('unauthorized') ||
           error.message.toLowerCase().includes('no active account'))) {
        throw new Error('Invalid email or password. Please try again.');
      }
      throw error;
    }
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register/', {
        username: data.email, // Use email as username
        email: data.email,
        password: data.password,
        password2: data.password, // Confirm password
        first_name: data.name?.split(' ')[0] || '',
        last_name: data.name?.split(' ').slice(1).join(' ') || '',
      });
      const { access, refresh } = response.data;
      tokenManager.setTokens(access, refresh);
      return response.data;
    } catch (error) {
      // Provide user-friendly error messages for common registration issues
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('username') && message.includes('exists')) {
          throw new Error('An account with this email already exists.');
        }
        if (message.includes('email') && (message.includes('exists') || message.includes('already'))) {
          throw new Error('An account with this email already exists.');
        }
        if (message.includes('password') && message.includes('common')) {
          throw new Error('This password is too common. Please choose a stronger password.');
        }
        if (message.includes('password') && message.includes('short')) {
          throw new Error('Password is too short. Please use at least 8 characters.');
        }
        if (message.includes('password') && message.includes('numeric')) {
          throw new Error('Password cannot be entirely numeric.');
        }
      }
      throw error;
    }
  },

  /**
   * Logout - clear tokens
   */
  async logout(): Promise<void> {
    tokenManager.clearTokens();
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await apiClient.get<{ user: { id: number; email: string; name: string }; tier: string; credits_remaining: number }>('/auth/profile/');
    const { user, tier, credits_remaining } = response.data;
    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      tier: tier as 'free' | 'pro' | 'enterprise',
      credits: credits_remaining,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.patch('/auth/profile/', data);
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return tokenManager.isAuthenticated();
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    const refresh = tokenManager.getRefreshToken();
    if (!refresh) throw new Error('No refresh token');
    
    const response = await apiClient.post<{ access: string }>('/auth/token/refresh/', { refresh });
    const { access } = response.data;
    tokenManager.setTokens(access, refresh);
    return access;
  },
};

export default authService;
