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
  ]),
]);

export default eslintConfig;
