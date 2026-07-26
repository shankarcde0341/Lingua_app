import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "@/src/api/client";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  english_level: string;
  xp: number;
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
  phone?: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  referral_count: number;
  referral_discount_active: boolean;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signInWithSessionId: (session_id: string) => Promise<void>;
  signInWithPhoneToken: (session_token: string, user: User) => Promise<void>;
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
      console.log("[Auth] bootstrap — token present?", !!token);
      if (!token) { setUser(null); return; }
      const me = await api.me();
      console.log("[Auth] bootstrap — /me returned user:", me?.user_id);
      setUser(me);
    } catch (e: any) {
      console.warn("[Auth] bootstrap failed, clearing token:", e?.message || e);
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const signInWithSessionId = useCallback(async (session_id: string) => {
    console.log("[Auth] signInWithSessionId — exchanging session_id");
    const res = await api.createSession(session_id);
    if (!res?.session_token || !res?.user) {
      throw new Error("Malformed auth response from server");
    }
    await setToken(res.session_token);
    console.log("[Auth] token saved; setting user", res.user.user_id);
    setUser(res.user);
  }, []);

  const signInWithPhoneToken = useCallback(async (session_token: string, freshUser: User) => {
    console.log("[Auth] signInWithPhoneToken — token saved");
    await setToken(session_token);
    setUser(freshUser);
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
    <AuthCtx.Provider value={{ user, loading, signInWithSessionId, signInWithPhoneToken, refresh, updateUser, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
