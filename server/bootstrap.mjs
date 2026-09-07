import fs from "node:fs";
import path from "node:path";
const hosted = () => process.env.NODE_ENV === "production" || ["RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID", "VERCEL", "NETLIFY", "RENDER", "K_SERVICE", "AWS_LAMBDA_FUNCTION_NAME", "FLY_APP_NAME", "DYNO"].some(key => Boolean(process.env[key]));
if (hosted()) throw new Error("The local bootstrap cannot start in a hosted/production runtime. Use the production start command.");
try { process.loadEnvFile(path.resolve(".env")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (hosted()) throw new Error("Local environment settings identify a hosted runtime; refusing a local password bypass.");
process.env.PG_LOCAL_BOOTSTRAP = "1";
process.env.PG_BIND_HOST = "127.0.0.1";
process.env.PG_DATA_DIR = path.resolve("data");
process.env.APP_URL = `http://localhost:${process.env.PORT || 3000}`;
process.env.TRUST_PROXY_HOPS = "0";
process.env.BILLING_ENABLED = "false";
process.env.BILLING_ALLOW_LIVE = "false";
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync("anthropic-key.txt")) process.env.ANTHROPIC_API_KEY = fs.readFileSync("anthropic-key.txt", "utf8").trim();
process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??= path.resolve("firebase-service-account.json");
await import("../dist/index.js");
