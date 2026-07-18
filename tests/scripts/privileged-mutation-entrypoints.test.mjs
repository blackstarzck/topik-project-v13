import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ENTRYPOINTS = [
  "scripts/backfill-comparison-blank-metrics.mjs",
  "scripts/design-review/full-ui-state-capture-qa.mjs",
  "scripts/seed-e2e-audit-fixtures.mjs",
  "tests/e2e/_tmp-seed-notif.mjs",
].sort();

function findMjsFiles(relativeDirectory) {
  return readdirSync(resolve(process.cwd(), relativeDirectory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return findMjsFiles(relativePath);
    return entry.isFile() && entry.name.endsWith(".mjs") ? [relativePath] : [];
  });
}

function findPrivilegedMutationEntrypoints() {
  return ["scripts", "tests/e2e"]
    .flatMap(findMjsFiles)
    .filter((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const mutatesSupabase =
        /\.(?:insert|upsert|delete)\s*\(/u.test(source) ||
        /\.from\([^)]*\)[\s\S]{0,400}?\.update\s*\(/u.test(source) ||
        /auth\.admin\.(?:createUser|updateUserById|deleteUser)\s*\(/u.test(
          source,
        );
      return (
        /SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)/u.test(source) &&
        mutatesSupabase
      );
    })
    .sort();
}

describe("privileged Supabase mutation entrypoints", () => {
  it("recursively discovers every service-key mutation entrypoint", () => {
    expect(findPrivilegedMutationEntrypoints()).toEqual(ENTRYPOINTS);
  });

  it.each(ENTRYPOINTS)(
    "%s invokes the common loopback guard before opening a client or request",
    (relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const guardIndex = source.indexOf("assertLocalPrivilegedMutationTarget(");
      const remoteBoundaryIndexes = [
        source.indexOf("createClient("),
        source.indexOf("fetch("),
      ].filter((index) => index >= 0);

      expect(source).toContain("supabase-target-safety.mjs");
      expect(guardIndex).toBeGreaterThanOrEqual(0);
      expect(remoteBoundaryIndexes.length).toBeGreaterThan(0);
      expect(guardIndex).toBeLessThan(Math.min(...remoteBoundaryIndexes));
    },
  );
});
