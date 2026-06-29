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

describe("comparison report same-problem guard", () => {
  it("prevents comparison reports across different writing problem IDs", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function private.enforce_comparison_report_same_problem",
    );
    expect(normalized).toContain(
      "before insert or update of user_id, current_submission_id, previous_submission_id on public.comparison_reports",
    );
    expect(normalized).toContain(
      "select user_id, problem_id into current_owner, current_problem",
    );
    expect(normalized).toContain(
      "select user_id, problem_id into previous_owner, previous_problem",
    );
    expect(normalized).toContain("if previous_problem <> current_problem then");
    expect(normalized).toContain(
      "raise exception 'comparison submissions must share problem_id'",
    );
  });

  it("keeps the comparison RPC aligned with the same-problem invariant", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function public.create_comparison_report_with_metrics",
    );
    expect(normalized).toContain(
      "if previous_id = current_id then raise exception 'comparison previous submission must differ from current submission'",
    );
    expect(normalized).toContain(
      "if previous_problem <> current_problem then raise exception 'comparison submissions must share problem_id'",
    );
    expect(normalized).toContain(
      "grant execute on function public.create_comparison_report_with_metrics(uuid, uuid, jsonb, text, text) to authenticated",
    );
  });
});
