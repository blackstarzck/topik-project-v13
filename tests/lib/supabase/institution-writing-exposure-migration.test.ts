import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const targetMigration = join(
  migrationsDir,
  "20260629170000_non_institution_writing_full_exposure.sql",
);

function readTargetMigration() {
  return readFileSync(targetMigration, "utf8");
}

function normalizedSql() {
  return readTargetMigration().replace(/\s+/g, " ").toLowerCase();
}

function normalizedAllMigrationsSql() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("institution writing exposure migration contract", () => {
  it("redefines the caller visibility predicate as non-institution full exposure and institution assigned-only", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function public.is_writing_problem_visible_to_caller",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("caller_id uuid := auth.uid()");
    expect(sql).toContain("profiles");
    expect(sql).toContain("affiliation_code");
    expect(sql).toContain("nullif(btrim(p.affiliation_code), '')");
    expect(sql).toContain("materials->>'question_id'");
    expect(sql).toContain("topik_writing_question_institution_exposure");
    expect(sql).toContain("if caller_code is null then");
    expect(sql).toContain("return true");
    expect(sql).toContain("if v_question_id is null then");
    expect(sql).toContain("return exists");
    expect(sql).toContain("e.institution_code = caller_code");
    expect(sql).toContain("e.item_number = p_question_no");
    expect(sql).toContain("return false");
    expect(sql).not.toContain("return not exists");
    expect(sql).not.toContain("return caller_code is null");
    expect(sql).toContain("non-institution");
    expect(sql).toContain("full");
    expect(sql).toContain("assigned-only");
  });

  it("redefines the owner-aware private predicate with the same split rule", () => {
    const sql = normalizedSql();

    expect(sql).toContain(
      "create or replace function private.is_writing_problem_visible_to_user",
    );
    expect(sql).toContain("p_user_id uuid");
    expect(sql).toContain("nullif(btrim(p.affiliation_code), '')");
    expect(sql).toContain("if caller_code is null then");
    expect(sql).toContain("return true");
    expect(sql).toContain("if v_question_id is null then");
    expect(sql).toContain("e.institution_code = caller_code");
    expect(sql).toContain("return false");
    expect(sql).not.toContain("return not exists");
  });

  it("exposes a batch filter for server recommendation paths", () => {
    const sql = normalizedAllMigrationsSql();

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
    const sql = normalizedAllMigrationsSql();

    expect(sql).toContain(
      "or public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
    expect(sql).toContain(
      "and public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
  });

  it("keeps owner-aware private helpers service-role only", () => {
    const sql = normalizedAllMigrationsSql();

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
