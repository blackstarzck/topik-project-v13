import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260722120000_writing_completion_and_pdf_outcomes.sql",
);

function migrationSql() {
  return readFileSync(migrationPath, "utf8");
}

describe("writing completion and PDF outcome migration", () => {
  it("counts learner completion only when submission and feedback are complete", () => {
    const sql = migrationSql();

    expect(sql).toContain("writing_submission.feedback_status = 'complete'");
    expect(sql).toContain("writing_feedback.status = 'complete'");
    expect(sql).toContain("writing_submission_attempt_count");
    expect(sql).toContain("activity.writing_submission_count > 0 then 'submitted'");
    expect(sql).toContain(
      "activity.writing_submission_attempt_count > 0 then 'attempted'",
    );
  });

  it("keeps dashboard attempt totals aligned to completed learner submissions", () => {
    const sql = migrationSql();

    expect(sql).toContain("create or replace function public.get_dashboard_kpi()");
    expect(sql.match(/feedback_status = 'complete'/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("adds sanitized terminal PDF outcome fields", () => {
    const sql = migrationSql();

    expect(sql).toContain("add column if not exists failure_code text");
    expect(sql).toContain("add column if not exists failed_at timestamptz");
    expect(sql).toContain("quota_exceeded");
    expect(sql).toContain("quota_claim_failed");
    expect(sql).toContain("server_render_failed");
    expect(sql).toContain("browser_print_prepare_failed");
    expect(sql).toContain("export_files_failure_terminal_shape");
    expect(sql).toMatch(
      /add constraint export_files_failure_code_allowed check \([\s\S]*?\)\s+not valid;/,
    );
    expect(sql).toContain(
      "validate constraint export_files_failure_code_allowed;",
    );
    expect(sql).toMatch(
      /add constraint export_files_failure_terminal_shape check \([\s\S]*?\)\s+not valid;/,
    );
    expect(sql).toContain(
      "validate constraint export_files_failure_terminal_shape;",
    );
  });
});
