/*
 * Minimal Vite config for the static demo preview build.
 * The main vite.config.ts drags in Manus-only dev plugins (manus-runtime,
 * jsx-loc, debug collector) that aren't needed — or wanted — outside Manus.
 * Usage: VITE_DEMO=1 npx vite build --config vite.preview.config.ts
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
  publicDir: false,
  build: {
    outDir: path.resolve(import.meta.dirname, "preview"),
    emptyOutDir: true,
  },
});
