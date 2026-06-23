import { db } from "./db";
import type { AuthSession } from "./types";

export interface GoogleCredentialPayload {
  aud: string;
  email: string;
  email_verified: boolean;
  exp: number;
  name?: string;
  picture?: string;
}

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const allowedGoogleEmails = (process.env.NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const isGoogleAuthEnabled = Boolean(googleClientId);

export const decodeGoogleCredential = (credential: string): GoogleCredentialPayload => {
  const [, payload] = credential.split(".");
  if (!payload) throw new Error("La respuesta de Google no tiene el formato esperado.");
  const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = decodeURIComponent(
    Array.from(atob(normalized))
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
  return JSON.parse(decoded) as GoogleCredentialPayload;
};

export const validateGoogleCredential = (credential: string): AuthSession => {
  const payload = decodeGoogleCredential(credential);
  if (payload.aud !== googleClientId) {
    throw new Error("El token de Google no pertenece a esta aplicacion.");
  }
  if (!payload.email_verified) {
    throw new Error("Google no ha verificado este email.");
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("La sesion de Google ha caducado.");
  }
  const email = payload.email.toLowerCase();
  if (allowedGoogleEmails.length && !allowedGoogleEmails.includes(email)) {
    throw new Error("Este email no esta autorizado para entrar.");
  }
  const now = new Date().toISOString();
  return {
    id: "google",
    email,
    name: payload.name ?? email,
    picture: payload.picture,
    credential,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    createdAt: now,
    updatedAt: now
  };
};

export const getValidAuthSession = async (): Promise<AuthSession | null> => {
  if (!isGoogleAuthEnabled) return null;
  const session = await db.authSessions.get("google");
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.authSessions.delete("google");
    return null;
  }
  if (allowedGoogleEmails.length && !allowedGoogleEmails.includes(session.email.toLowerCase())) {
    await db.authSessions.delete("google");
    return null;
  }
  return session;
};

export const saveAuthSession = async (session: AuthSession): Promise<void> => {
  await db.authSessions.put({ ...session, updatedAt: new Date().toISOString() });
};

export const signOut = async (): Promise<void> => {
  await db.authSessions.delete("google");
  if (typeof window !== "undefined") {
    window.google?.accounts.id.disableAutoSelect();
  }
};
