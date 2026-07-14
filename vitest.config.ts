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
    setupFiles: ["./tests/setup.ts"],
    // Integration tests dynamically import full server-component module graphs
    // (antd + page + all deps) and render them. Under parallel worker load —
    // e.g. consecutive full-suite runs or CI contention — that import+render
    // occasionally exceeds the vitest 5s default. Full-suite validation on a
    // load-saturated Windows worktree has also pushed otherwise-passing page
    // imports just past 20s (observed across writing-flow / learning-flow /
    // admin-role-matrix). The headroom removes that false positive without
    // masking a real deadlock, which would still hang to this ceiling.
    testTimeout: 40000,
    include: ["tests/**/*.{test,spec}.{ts,tsx,mjs}"],
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
