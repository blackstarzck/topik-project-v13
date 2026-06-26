import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const activeFiles = [
  ".env.example",
  "AGENTS.md",
  "package.json",
  "supabase/README.md",
];

const forbiddenPatterns = [
  /\bSUPABASE_ACCESS_TOKEN\b/,
  /\bsupabase\s+link\b/i,
  /\bsupabase\s+db\s+push\b/i,
  /\bsupabase\s+db\s+query\b/i,
];

describe("v13 Supabase remote-apply boundary", () => {
  it("does not expose remote Supabase management tokens or apply commands in active files", () => {
    const violations = activeFiles.flatMap((relativePath) => {
      const text = readFileSync(join(root, relativePath), "utf8");
      return forbiddenPatterns
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${relativePath}: ${pattern.source}`);
    });

    expect(violations).toEqual([]);
  });

  it("does not carry institution exposure schema ownership in v13 migrations", () => {
    expect(
      existsSync(
        join(
          root,
          "supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          root,
          "docs/todo/v13-institution-question-exposure-handoff-2026-06-26.md",
        ),
      ),
    ).toBe(false);
  });
});
