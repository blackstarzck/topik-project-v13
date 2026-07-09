import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function normalizedLibraryProblemAnswerPreviewSql() {
  const migrationName = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .find((name) => name.includes("library_problem_answer_preview"));

  expect(migrationName).toBeTruthy();

  return readFileSync(join(migrationsDir, migrationName as string), "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("library problem answer preview migration contract", () => {
  it("returns a saved problem answer_text preview without changing retry availability", () => {
    const sql = normalizedLibraryProblemAnswerPreviewSql();

    expect(sql).toContain(
      "create or replace function public.list_user_library_problem_items",
    );
    expect(sql).toContain("answer_text text");
    expect(sql).toContain("latest_draft");
    expect(sql).toContain("latest_submission");
    expect(sql).toContain(
      "coalesce(latest_draft.answer_text, latest_submission.answer_text)",
    );
    expect(sql).toContain(
      "public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "grant execute on function public.list_user_library_problem_items() to authenticated",
    );
  });
});
