import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    "out/**",
    "build/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
    "docs/**",
    // Throwaway QA diagnostic scripts — mirrors the .prettierignore exclusion.
    ".scratch/**",
    // Sibling task worktrees (gitignored checkouts of this same repo). Without this,
    // `eslint .` lints every sibling worktree, including their nested `.scratch/`
    // directories that the root-anchored `.scratch/**` pattern above cannot reach.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
