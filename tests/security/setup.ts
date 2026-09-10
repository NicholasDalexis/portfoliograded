import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.PG_DATA_DIR = mkdtempSync(path.join(tmpdir(), "pg-compose-api-"));
for (const key of [
  "FIREBASE_SERVICE_ACCOUNT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "APP_URL",
  "BILLING_ENABLED",
  "BILLING_ALLOW_LIVE",
  "PREVIEW_PASSWORD_HASH",
  "PG_LOCAL_BOOTSTRAP",
  "PG_BIND_HOST",
])
  delete process.env[key];
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = path.join(
  process.env.PG_DATA_DIR,
  "nonexistent-test-key.json",
);
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, options?: RequestInit) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input
        : input.url,
  );
  if (url.hostname !== "127.0.0.1")
    throw new Error(
      "External network disabled in builder API regression tests",
    );
  return nativeFetch(input, options);
}) as typeof fetch;
