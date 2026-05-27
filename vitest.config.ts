import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".next/**",
      // Playwright e2e specs run via `pnpm exec playwright test`, not vitest.
      "tests/e2e/**",
    ],
  },
});
