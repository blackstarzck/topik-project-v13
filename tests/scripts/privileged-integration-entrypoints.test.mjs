import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ENTRYPOINTS = [
  "tests/integration/account-deletion-rpc.test.ts",
  "tests/integration/auth-completion-gate-rpc.test.ts",
  "tests/integration/institution-writing-exposure.test.ts",
  "tests/integration/pdf-export-quota-rpc.test.ts",
  "tests/integration/user-data-reference-integrity-local.test.ts",
  "tests/integration/writing-submission-dedup.test.ts",
  "tests/integration/writing-submission-outbox-local.test.ts",
].sort();

function findPrivilegedMutationEntrypoints() {
  return listIntegrationTestFiles(
    resolve(process.cwd(), "tests/integration"),
    "tests/integration",
  )
    .filter((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const usesPrivilegedKey =
        /SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)/u.test(source);
      const mutatesSupabase =
        /\.(?:insert|upsert|delete)\s*\(/u.test(source) ||
        /\.from\([^)]*\)[\s\S]{0,400}?\.update\s*\(/u.test(source) ||
        /\.rpc\s*\(/u.test(source);
      return usesPrivilegedKey && mutatesSupabase;
    })
    .sort();
}

function listIntegrationTestFiles(directory, relativeDirectory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      return listIntegrationTestFiles(
        resolve(directory, entry.name),
        relativePath,
      );
    }
    return entry.isFile() && entry.name.endsWith(".test.ts")
      ? [relativePath]
      : [];
  });
}

describe("privileged Supabase integration entrypoints", () => {
  it("recursively discovers every service-key mutation integration test", () => {
    expect(findPrivilegedMutationEntrypoints()).toEqual(ENTRYPOINTS);
  });

  it.each(ENTRYPOINTS)(
    "%s invokes the common loopback guard before a Supabase client is opened",
    (relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const guardIndex = source.indexOf("assertLocalPrivilegedMutationTarget(");
      const clientIndex = source.indexOf("createClient(");

      expect(source).toContain("scripts/lib/supabase-target-safety.mjs");
      expect(guardIndex).toBeGreaterThanOrEqual(0);
      expect(clientIndex).toBeGreaterThanOrEqual(0);
      expect(guardIndex).toBeLessThan(clientIndex);
    },
  );
});
