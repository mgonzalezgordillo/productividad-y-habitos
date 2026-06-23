import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, type Firestore } from "firebase/firestore";

const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID"
] as const;

const placeholderMarkers = ["TU_", "YOUR_", "REPLACE_", "NEXT_PUBLIC_FIREBASE_"];

const readEnv = (key: (typeof requiredKeys)[number] | "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID") =>
  process.env[key]?.trim() ?? "";

const hasValidValue = (value: string): boolean =>
  Boolean(value) && !placeholderMarkers.some((marker) => value.toUpperCase().includes(marker));

export const getFirebaseConfig = () => ({
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId: readEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID")
});

export const firebaseConfigError = (() => {
  const missing = requiredKeys.filter((key) => !hasValidValue(readEnv(key)));
  if (missing.length) {
    return `Falta configuracion publica de Firebase: ${missing.join(", ")}.`;
  }
  return null;
})();

export const isFirebaseConfigured = firebaseConfigError === null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured) return null;
  if (app) return app;
  const config = getFirebaseConfig();
  app = getApps().length ? getApp() : initializeApp(config);
  return app;
};

export const getFirebaseAuth = (): Auth | null => {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  auth = initializeAuth(firebaseApp, {
    persistence: [indexedDBLocalPersistence]
  });
  return auth;
};

export const getFirebaseFirestore = (): Firestore | null => {
  if (firestore) return firestore;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: false })
    })
  });
  return firestore;
};
