import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserRole } from '../../types';
import { login as apiLogin, getCurrentUser, logout as apiLogout } from '../../services/authService';
import { getAuthToken } from '../../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLoginAsRole: (role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  ADMIN: { email: 'admin@ris.local', password: 'Demo@123' },
  RECEPTION: { email: 'reception@ris.local', password: 'Demo@123' },
  TECHNOLOGIST: { email: 'tech@ris.local', password: 'Demo@123' },
  RADIOLOGIST: { email: 'rad@ris.local', password: 'Demo@123' },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      apiLogout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin({ email, password });
      setUser(loggedInUser);
    } finally {
      setIsLoading(false);
    }
  };

  const quickLoginAsRole = async (role: UserRole): Promise<void> => {
    const creds = DEMO_CREDENTIALS[role];
    await login(creds.email, creds.password);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        quickLoginAsRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
