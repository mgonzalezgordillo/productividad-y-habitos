const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID"
];
const placeholderMarkers = ["TU_", "YOUR_", "REPLACE_", "NEXT_PUBLIC_FIREBASE_"];

function fail(message) {
  console.error(`Firebase configuration error: ${message}`);
  process.exit(1);
}

for (const key of requiredKeys) {
  const value = process.env[key];
  if (typeof value !== "string" || !value.trim()) {
    fail(`${key} is required for this build.`);
  }
  const normalized = value.trim();
  if (normalized !== value || normalized.startsWith('"') || normalized.endsWith('"') || normalized.startsWith("'") || normalized.endsWith("'")) {
    fail(`${key} must not contain surrounding spaces or quotes.`);
  }
  const upperValue = normalized.toUpperCase();
  if (placeholderMarkers.some((marker) => upperValue.includes(marker))) {
    fail(`${key} still contains a placeholder.`);
  }
}
