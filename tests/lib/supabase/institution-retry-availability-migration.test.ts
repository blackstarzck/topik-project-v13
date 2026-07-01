import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function normalizedRetryAvailabilityMigrationSql() {
  const migrationName = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .find((name) => name.includes("institution_retry_availability"));

  expect(migrationName).toBeTruthy();

  return readFileSync(join(migrationsDir, migrationName as string), "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("institution retry availability migration contract", () => {
  it("uses institution visibility when deciding saved problem retry availability", () => {
    const sql = normalizedRetryAvailabilityMigrationSql();

    expect(sql).toContain(
      "create or replace function public.list_user_library_problem_items",
    );
    expect(sql).toContain(
      "public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain("then 'available'");
    expect(sql).toContain("then 'hard_unavailable'");
    expect(sql).toContain(
      "grant execute on function public.list_user_library_problem_items() to authenticated",
    );
  });
});
