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
  display_name?: string;
  avatar?: string;
  bio?: string;
  instance_name?: string;
  timezone?: string;
  language?: string;
  tier: 'free' | 'pro' | 'enterprise';
  credits: number;
  llm_provider?: string;
  llm_model?: string;
  default_temperature?: number;
  default_max_tokens?: number;
  theme_preference?: 'light' | 'dark' | 'system';
  accent_color?: string;
  createdAt: string;
}

export interface UsageInsight {
  total_executions: number;
  total_cost: string;
  success_rate: number;
  hours_saved: number;
  daily_stats: any[];
  tier: string;
  credits_remaining: number;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface OTPVerifyResponse {
  detail: string;
  verification_token: string;
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
        email: credentials.email,
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
    const response = await apiClient.get<any>('/auth/profile/');
    const data = response.data;
    
    // The backend returns the UserProfile structure
    return {
      id: data.user.id,
      email: data.user.email,
      name: `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() || data.user.username,
      display_name: data.display_name,
      avatar: data.avatar,
      bio: data.bio,
      instance_name: data.instance_name,
      timezone: data.timezone,
      language: data.language,
      tier: data.tier,
      credits: data.credits_remaining,
      llm_provider: data.llm_provider,
      llm_model: data.llm_model,
      default_temperature: data.default_temperature,
      default_max_tokens: data.default_max_tokens,
      theme_preference: data.theme_preference,
      accent_color: data.accent_color,
      createdAt: data.created_at,
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
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post('/auth/profile/avatar/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async requestPasswordChangeOTP(oldPassword: string): Promise<{ detail: string }> {
    const response = await apiClient.post('/auth/change-password/request-otp/', {
      old_password: oldPassword,
    });
    return response.data;
  },

  async verifyPasswordChangeOTP(otpCode: string): Promise<OTPVerifyResponse> {
    const response = await apiClient.post('/auth/change-password/verify-otp/', {
      otp_code: otpCode,
    });
    return response.data;
  },

  async changePassword(data: {
    old_password: string;
    verification_token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ detail: string }> {
    const response = await apiClient.post('/auth/change-password/', data);
    return response.data;
  },

  async requestPasswordReset(email: string): Promise<{ detail: string }> {
    const response = await apiClient.post('/auth/password-reset-request/', { email });
    return response.data;
  },

  async verifyPasswordResetOTP(email: string, otpCode: string): Promise<OTPVerifyResponse> {
    const response = await apiClient.post('/auth/password-reset-verify/', {
      email,
      otp_code: otpCode,
    });
    return response.data;
  },

  async confirmPasswordReset(data: {
    email: string;
    verification_token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ detail: string }> {
    const response = await apiClient.post('/auth/password-reset-confirm/', data);
    return response.data;
  },

  /**
   * Get usage insights
   */
  async getUsageInsights(): Promise<UsageInsight> {
    const response = await apiClient.get<UsageInsight>('/usage/insights/');
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return tokenManager.isAuthenticated();
  },

  /**
   * Get current API Key
   */
  async getApiKey(): Promise<{ key: string; created_at: string }> {
    const response = await apiClient.get('/auth/api-keys/');
    // Assuming the backend returns a list, we take the first one or a specific structure
    // If backend returns { results: [...] } or just [...]
    const data = response.data as any;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    } else if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      return data.results[0];
    }
    return { key: '', created_at: '' };
  },

  /**
   * Regenerate API Key
   */
  async regenerateApiKey(): Promise<{ key: string; created_at: string }> {
    const response = await apiClient.post('/auth/api-keys/');
    return response.data;
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    const refresh = tokenManager.getRefreshToken();
    if (!refresh) throw new Error('No refresh token');
    
    const response = await apiClient.post<{ access: string, refresh?: string }>('/auth/token/refresh/', { refresh });
    const { access, refresh: newRefresh } = response.data;
    tokenManager.setTokens(access, newRefresh || refresh);
    return access;
  },
};

export default authService;
