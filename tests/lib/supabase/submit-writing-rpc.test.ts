import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
}

describe("submit_writing_with_feedback problem visibility guard", () => {
  it("checks that a writing problem is public and active before inserting a submission", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("private.assert_writing_problem_submittable");
    expect(normalized).toContain("p.domain = 'writing'");
    expect(normalized).toContain("p.question_no = p_question_no");
    expect(normalized).toContain("p.publish_status = 'published'");
    expect(normalized).toContain("p.visibility = 'public'");
    expect(normalized).toContain("p.lifecycle_status = 'active'");
    expect(normalized).toContain("raise exception 'problem_not_submittable'");

    const guardIndex = normalized.indexOf(
      "perform private.assert_writing_problem_submittable",
    );
    const insertIndex = normalized.lastIndexOf(
      "insert into public.writing_submissions",
    );

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(guardIndex);
  });
});
