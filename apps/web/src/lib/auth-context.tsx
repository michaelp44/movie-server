'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@movie-server/shared';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from './api';

interface AuthContextType {
  user: User | null;
  ntfyTopic: string | null;
  ntfySubscribeUrl: string | null;
  ntfyWebUrl: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ntfyTopic, setNtfyTopic] = useState<string | null>(null);
  const [ntfySubscribeUrl, setNtfySubscribeUrl] = useState<string | null>(null);
  const [ntfyWebUrl, setNtfyWebUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getCurrentUser();
      setUser(result?.user ?? null);
      setNtfyTopic(result?.ntfyTopic ?? null);
      setNtfySubscribeUrl(result?.ntfySubscribeUrl ?? null);
      setNtfyWebUrl(result?.ntfyWebUrl ?? null);
    } catch {
      setUser(null);
      setNtfyTopic(null);
      setNtfySubscribeUrl(null);
      setNtfyWebUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const loggedInUser = await apiLogin(username, password);
    setUser(loggedInUser);
    await refresh(); // Refresh to get ntfyTopic
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setNtfyTopic(null);
    setNtfySubscribeUrl(null);
    setNtfyWebUrl(null);
  };

  return (
    <AuthContext.Provider value={{ user, ntfyTopic, ntfySubscribeUrl, ntfyWebUrl, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
