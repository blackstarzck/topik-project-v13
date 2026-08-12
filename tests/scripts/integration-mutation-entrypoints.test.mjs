import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ENTRYPOINTS = [
  "tests/integration/account-deletion-rpc.test.ts",
  "tests/integration/auth-completion-gate-rpc.test.ts",
  "tests/integration/institution-writing-exposure.test.ts",
  "tests/integration/pdf-export-quota-rpc.test.ts",
  "tests/integration/profile-trigger.test.ts",
  "tests/integration/rls-smoke.test.ts",
  "tests/integration/user-data-reference-integrity-local.test.ts",
  "tests/integration/writing-submission-dedup.test.ts",
  "tests/integration/writing-submission-outbox-local.test.ts",
].sort();

function findPublicKeyMutationEntrypoints() {
  return readdirSync(resolve(process.cwd(), "tests/integration"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => `tests/integration/${entry.name}`)
    .filter((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const usesPublicKey = /NEXT_PUBLIC_SUPABASE_(?:PUBLISHABLE|ANON)_KEY/u.test(
        source,
      );
      const mutates =
        /auth\.signUp\s*\(/u.test(source) ||
        /\.rpc\s*\(/u.test(source) ||
        /\.(?:insert|upsert|update|delete)\s*\(/u.test(source);
      return usesPublicKey && mutates;
    })
    .sort();
}

describe("public-key Supabase integration mutation entrypoints", () => {
  it("discovers sign-up, RPC, and table mutation suites", () => {
    expect(findPublicKeyMutationEntrypoints()).toEqual(ENTRYPOINTS);
  });

  it.each(ENTRYPOINTS)(
    "%s invokes a shared numeric-loopback mutation guard before creating a client",
    (relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const guardIndexes = [
        source.indexOf("assertLocalPublicMutationTarget("),
        source.indexOf("assertLocalPrivilegedMutationTarget("),
      ].filter((index) => index >= 0);
      const clientIndex = source.indexOf("createClient(");

      expect(source).toContain("supabase-target-safety.mjs");
      expect(guardIndexes.length).toBeGreaterThan(0);
      expect(clientIndex).toBeGreaterThanOrEqual(0);
      expect(Math.min(...guardIndexes)).toBeLessThan(clientIndex);
    },
  );

  it("keeps the local integration package script explicitly opted in", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );
    const command = packageJson.scripts["test:supabase:local"];

    expect(command).toContain("SUPABASE_LOCAL_STACK=1");
    expect(command).toContain("E2E_ALLOW_DEV_DB_MUTATION=1");
    for (const relativePath of ENTRYPOINTS) {
      expect(command).toContain(relativePath);
    }
  });
});
