import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const targetMigration = join(
  migrationsDir,
  "20260626110000_writing_institution_visibility_predicate.sql",
);

function readTargetMigration() {
  return readFileSync(targetMigration, "utf8");
}

function normalizedSql() {
  return readTargetMigration().replace(/\s+/g, " ").toLowerCase();
}

describe("institution writing exposure migration contract", () => {
  it("defines a security-definer caller visibility predicate", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function public.is_writing_problem_visible_to_caller",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("caller_id uuid := auth.uid()");
    expect(sql).toContain("profiles");
    expect(sql).toContain("affiliation_code");
    expect(sql).toContain("materials->>'question_id'");
    expect(sql).toContain("topik_writing_question_institution_exposure");
    expect(sql).toContain("e.institution_code = caller_code");
    expect(sql).toContain("e.item_number = p_question_no");
  });

  it("exposes a batch filter for server recommendation paths", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function public.filter_visible_writing_problem_ids",
    );
    expect(sql).toContain("p.id = any(p_problem_ids)");
    expect(sql).toContain("and p.domain = 'writing'");
    expect(sql).toContain(
      "public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "grant execute on function public.filter_visible_writing_problem_ids(uuid[]) to authenticated",
    );
  });

  it("uses the institution predicate from list and submit guards", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "or public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "and public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
  });

  it("keeps owner-aware private helpers service-role only", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) to service_role",
    );
    expect(sql).not.toContain(
      "grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) to service_role",
    );
    expect(sql).not.toContain(
      "grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) to authenticated",
    );
  });
});
