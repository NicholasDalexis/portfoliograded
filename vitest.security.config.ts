import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
// Default: repository containing this config. Override only when verifying an
// isolated copy of these tests against a separate checkout.
const sourceRoot = process.env.PG_SECURITY_SOURCE_DIR
  ? path.resolve(process.env.PG_SECURITY_SOURCE_DIR)
  : packageRoot;

export default defineConfig({
  root: packageRoot,
  resolve: {
    alias: {
      "@server": path.join(sourceRoot, "server"),
      "@shared": path.join(sourceRoot, "shared"),
      "@": path.join(sourceRoot, "client/src"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/security/*.test.ts"],
    setupFiles: ["./tests/security/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 10_000,
  },
});
