"use client";
/** App-wide authentication state, backed by the @gesturia/core SDK (JWT with auto-refresh, tokens in
 *  localStorage). Wraps the whole app in layout.tsx; pages read it via useAuth(). */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { UserProfile } from "@gesturia/core";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;                       // true until the initial "am I logged in?" check finishes
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;           // re-pull the profile (after XP/hearts change)
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await api.auth.isAuthed()) ? await api.auth.me() : null);
    } catch {
      setUser(null);                      // stale/invalid token -> treat as logged out
    }
  }, []);

  useEffect(() => {
    (async () => { await refresh(); setLoading(false); })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await api.auth.login(email, password);
    setUser(await api.auth.me());
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    await api.auth.register(email, password, displayName);
    setUser(await api.auth.me());
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
