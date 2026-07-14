import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = "20260709120000_dashboard_kpi_writing_source.sql";

function readMigration() {
  return readFileSync(join(migrationsDir, migrationName), "utf8");
}

function normalize(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("get_dashboard_kpi writing source migration", () => {
  it("keeps the public RPC contract and authenticated execute grant", () => {
    const normalized = normalize(readMigration());

    expect(normalized).toContain(
      "create or replace function public.get_dashboard_kpi()",
    );
    expect(normalized).toContain(
      "returns table ( today_attempts int, total_attempts int, exam_days_left int, streak_days int )",
    );
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = pg_catalog, public");
    expect(normalized).toContain("caller_id uuid := auth.uid()");
    expect(normalized).toContain("raise exception 'unauthenticated'");
    expect(normalized).toContain(
      "revoke all on function public.get_dashboard_kpi() from public",
    );
    expect(normalized).toContain(
      "grant execute on function public.get_dashboard_kpi() to authenticated",
    );
  });

  it("uses writing submissions for submission counts and study events for streak", () => {
    const normalized = normalize(readMigration());

    expect(normalized).toContain("from public.writing_submissions");
    expect(normalized).toContain("submitted_at >= today_start");
    expect(normalized).toContain("submitted_at < today_end");
    expect(normalized).toContain("from public.study_events");
    expect(normalized).toContain("occurred_at at time zone 'asia/seoul'");
    expect(normalized).toContain("select distinct");
    expect(normalized).not.toContain("from public.problem_attempts");
  });
});

describe("migration index", () => {
  it("records both the writing metrics backfill and dashboard KPI migration", () => {
    const normalized = normalize(
      readFileSync(join(migrationsDir, "INDEX.md"), "utf8"),
    );

    expect(normalized).toContain(
      "20260708113000_writing_submission_metrics.sql",
    );
    expect(normalized).toContain(
      "20260709120000_dashboard_kpi_writing_source.sql",
    );
  });
});

describe("KPI source SOT", () => {
  it("documents submission-count and streak sources in the durable Supabase contract", () => {
    const contract = normalize(
      readFileSync(
        join(process.cwd(), "docs", "supabase", "database-api-contract.md"),
        "utf8",
      ),
    );

    expect(contract).toContain("dashboard/growth kpi");
    expect(contract).toContain("`writing_submissions.submitted_at`");
    expect(contract).toContain("`writing_submission_metrics`");
    expect(contract).toContain("`study_events`");
  });
});
