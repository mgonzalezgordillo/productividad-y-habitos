"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  authConfigError,
  signInWithGoogle,
  signOut as firebaseSignOut,
  subscribeToAuthState,
  type AuthenticatedUser
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authConfigError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
        if (nextUser) setError(null);
      },
      (authError) => {
        setError(authError.message);
        setUser(null);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signInWithGoogle,
      signOut: firebaseSignOut,
      authConfigError
    }),
    [error, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return value;
};
