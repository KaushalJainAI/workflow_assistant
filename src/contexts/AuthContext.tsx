/**
 * Auth Context
 * 
 * Global authentication state and methods.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService } from '../api/auth';
import type { User } from '../api/auth';
import { tokenManager } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  googleLogin: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (tokenManager.isAuthenticated()) {
        try {
          const userData = await authService.getProfile();
          setUser(userData);
        } catch (err) {
          // Token invalid, clear it
          tokenManager.clearTokens();
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ email, password });
      setUser(response.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register({ email, password, name });
      setUser(response.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const googleLogin = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.googleLogin(code);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (tokenManager.isAuthenticated()) {
      try {
        const userData = await authService.getProfile();
        setUser(userData);
      } catch (err) {
        // Token invalid
        tokenManager.clearTokens();
        setUser(null);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    googleLogin,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
