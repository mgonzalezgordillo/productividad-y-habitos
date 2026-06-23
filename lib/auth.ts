"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import { firebaseConfigError, getFirebaseAuth } from "./firebase";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

const rawAllowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS ?? "").trim();

const placeholderMarkers = ["NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS", "TU_", "YOUR_", "REPLACE_"];

export const allowedGoogleEmails = rawAllowedEmails
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => Boolean(email) && !placeholderMarkers.some((marker) => email.toUpperCase().includes(marker)));

export const authConfigError = firebaseConfigError;

export const isAllowedGoogleEmail = (email?: string | null): boolean => {
  if (!allowedGoogleEmails.length) return true;
  if (!email) return false;
  return allowedGoogleEmails.includes(email.toLowerCase());
};

export const toAuthenticatedUser = (user: User): AuthenticatedUser => ({
  id: user.uid,
  email: user.email ?? "",
  name: user.displayName ?? undefined,
  picture: user.photoURL ?? undefined
});

const isPopupFallbackError = (error: unknown): boolean => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  return (
    code === "auth/popup-blocked" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/operation-not-supported-in-this-environment"
  );
};

const normalizeAuthError = (error: unknown): Error =>
  error instanceof Error ? error : new Error("No se pudo completar el inicio de sesion con Google.");

export const signInWithGoogle = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(authConfigError ?? "No se ha configurado Firebase.");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (isPopupFallbackError(error)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw normalizeAuthError(error);
  }
};

export const signOut = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
};

export const subscribeToAuthState = (
  onUser: (user: AuthenticatedUser | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const auth = getFirebaseAuth();
  if (!auth) {
    onUser(null);
    return () => undefined;
  }

  return onAuthStateChanged(
    auth,
    async (user) => {
      try {
        if (!user) {
          onUser(null);
          return;
        }
        const authenticatedUser = toAuthenticatedUser(user);
        if (!isAllowedGoogleEmail(authenticatedUser.email)) {
          await firebaseSignOut(auth);
          onError?.(new Error("Este correo no esta autorizado para entrar."));
          onUser(null);
          return;
        }
        onUser(authenticatedUser);
      } catch (error) {
        onError?.(normalizeAuthError(error));
        onUser(null);
      }
    },
    (error) => {
      onError?.(normalizeAuthError(error));
      onUser(null);
    }
  );
};
