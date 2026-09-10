/*
 * portfolio graded — Vite config (clean, post-Manus).
 *
 * 2026-07-09: rewritten. The previous config was the Manus scaffold and it
 * INJECTED a session-replay/telemetry script (/__manus__/debug-collector.js)
 * into every build, plus a storage proxy, a log-writing middleware, and the
 * manus-runtime / jsx-loc plugins. All of it is gone. Nothing here phones
 * home. Do not reintroduce.
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: false, // The old public directory contains only retired Manus debug files.
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    fs: { strict: true, deny: ["**/.*"] },
  },
});
