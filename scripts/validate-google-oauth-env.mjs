const required = process.env.NEXT_PUBLIC_REQUIRE_GOOGLE_LOGIN === "true";
const value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const placeholderMarkers = [
  "TU_CLIENT_ID",
  "YOUR_CLIENT_ID",
  "REPLACE",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_CLIENT_ID",
  "REACT_APP_GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_ID"
];
const clientIdPattern = /^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$/;

function fail(message) {
  console.error(`Google OAuth configuration error: ${message}`);
  process.exit(1);
}

if (!required && !value) {
  process.exit(0);
}

if (typeof value !== "string" || !value.trim()) {
  fail("NEXT_PUBLIC_GOOGLE_CLIENT_ID is required for this build.");
}

const normalized = value.trim();
if (normalized !== value || normalized.startsWith('"') || normalized.endsWith('"') || normalized.startsWith("'") || normalized.endsWith("'")) {
  fail("NEXT_PUBLIC_GOOGLE_CLIENT_ID must not contain surrounding spaces or quotes.");
}

const upperValue = normalized.toUpperCase();
if (placeholderMarkers.some((marker) => upperValue.includes(marker))) {
  fail("NEXT_PUBLIC_GOOGLE_CLIENT_ID still contains a placeholder.");
}

if (!clientIdPattern.test(normalized)) {
  fail("NEXT_PUBLIC_GOOGLE_CLIENT_ID must be a Web OAuth Client ID ending in .apps.googleusercontent.com.");
}
