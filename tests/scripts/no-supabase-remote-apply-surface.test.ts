import { readFileSync } from "node:fs";
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

  it("guards the mutating PDF quota integration behind an explicit loopback local stack", () => {
    const integrationTest = readFileSync(
      join(root, "tests", "integration", "pdf-export-quota-rpc.test.ts"),
      "utf8",
    );

    expect(integrationTest).toContain(
      'process.env.SUPABASE_LOCAL_STACK === "1"',
    );
    expect(integrationTest).toContain("isLoopbackUrl(SUPABASE_URL)");
  });

  it("does not carry institution exposure schema ownership in v13 migrations", () => {
    const migrationSql = [
      "supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql",
      "supabase/migrations/20260629110000_institution_assigned_only_writing_access.sql",
    ]
      .map((relativePath) => readFileSync(join(root, relativePath), "utf8"))
      .join("\n")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(migrationSql).not.toMatch(
      /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.topik_writing_question_institution_exposure/,
    );
    expect(migrationSql).not.toMatch(
      /alter\s+table\s+public\.topik_writing_question_institution_exposure/,
    );
    const contract = readFileSync(
      join(root, "docs", "supabase", "database-api-contract.md"),
      "utf8",
    );
    expect(contract).toContain(
      "`topik_writing_question_institution_exposure`",
    );
    expect(contract).toContain("v13 migration은 이 table을 생성하거나 변경하지 않는다");
  });
});
