import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "@/src/api/client";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  english_level: string;
  xp: number;
  coins: number;
  streak: number;
  daily_goal_minutes: number;
  daily_goal_completed_minutes: number;
  is_premium: boolean;
  premium_plan?: string | null;
  premium_until?: string | null;
  saved_words: string[];
  friends: string[];
  blocked: string[];
  achievements: string[];
  certificates: any[];
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signInWithSessionId: (session_id: string) => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: User) => void;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) { setUser(null); return; }
      const me = await api.me();
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const signInWithSessionId = useCallback(async (session_id: string) => {
    const res = await api.createSession(session_id);
    await setToken(res.session_token);
    setUser(res.user);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch { /* ignore */ }
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, signInWithSessionId, refresh, updateUser, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
