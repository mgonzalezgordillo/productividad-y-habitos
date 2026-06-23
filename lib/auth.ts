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

export const requireGoogleLogin = process.env.NEXT_PUBLIC_REQUIRE_GOOGLE_LOGIN === "true";

const rawGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const placeholderClientIdMarkers = [
  "TU_CLIENT_ID",
  "YOUR_CLIENT_ID",
  "REPLACE",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_CLIENT_ID",
  "REACT_APP_GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_ID"
];

const googleClientIdPattern = /^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$/;

export const validateGoogleClientId = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("Falta la configuracion de Google OAuth.");
  }

  const normalized = value.trim();
  const upperValue = normalized.toUpperCase();
  if (!normalized) {
    throw new Error("Falta la configuracion de Google OAuth.");
  }
  if (normalized !== value || normalized.startsWith('"') || normalized.endsWith('"') || normalized.startsWith("'") || normalized.endsWith("'")) {
    throw new Error("El Google OAuth Client ID no debe contener espacios ni comillas.");
  }
  if (placeholderClientIdMarkers.some((marker) => upperValue.includes(marker))) {
    throw new Error("El Google OAuth Client ID sigue siendo un placeholder.");
  }
  if (!googleClientIdPattern.test(normalized)) {
    throw new Error("El Google OAuth Client ID no tiene formato de cliente web valido.");
  }

  return normalized;
};

export const maskGoogleClientId = (value: string): string => {
  const normalized = value.trim();
  const suffix = ".apps.googleusercontent.com";
  if (!normalized.endsWith(suffix)) return "configuracion no valida";
  const body = normalized.slice(0, -suffix.length);
  if (body.length <= 8) return `****${suffix}`;
  return `${body.slice(0, 4)}...${body.slice(-4)}${suffix}`;
};

export const getGoogleClientIdConfig = (
  value: unknown = rawGoogleClientId
): { clientId: string | null; error: string | null } => {
  try {
    return { clientId: validateGoogleClientId(value), error: null };
  } catch (error) {
    const rawValue = typeof value === "string" ? value.trim() : "";
    if (!rawValue && !requireGoogleLogin) return { clientId: null, error: null };
    return {
      clientId: null,
      error: error instanceof Error ? error.message : "La configuracion de Google OAuth no es valida."
    };
  }
};

const allowedEmailsPlaceholder = "NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS";

export const allowedGoogleEmails = (process.env.NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => Boolean(email) && email !== allowedEmailsPlaceholder.toLowerCase());

export const googleClientIdConfig = getGoogleClientIdConfig();
export const googleClientId = googleClientIdConfig.clientId ?? "";
export const googleAuthConfigError = googleClientIdConfig.error;

export const isGoogleAuthEnabled = requireGoogleLogin || Boolean(googleClientId);

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
  const validGoogleClientId = validateGoogleClientId(googleClientId);
  const payload = decodeGoogleCredential(credential);
  if (payload.aud !== validGoogleClientId) {
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
