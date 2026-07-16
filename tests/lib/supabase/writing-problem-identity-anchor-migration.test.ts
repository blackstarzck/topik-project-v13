import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260713080015_writing_problem_identity_anchor.sql",
);
const downMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "down",
  "20260713080015_writing_problem_identity_anchor.sql",
);
const sql = readFileSync(migrationPath, "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("writing problem identity anchor migration", () => {
  it("creates a private service-role-only function", () => {
    expect(sql).toContain(
      "create or replace function private.ensure_writing_problem_anchor",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public, private");
    expect(sql).toContain(
      "grant execute on function private.ensure_writing_problem_anchor(uuid, text, smallint) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function private.ensure_writing_problem_anchor(uuid, text, smallint) from authenticated",
    );
    expect(sql).toContain(
      "revoke all on function private.ensure_writing_problem_anchor(uuid, text, smallint) from anon",
    );
  });

  it("inserts only an inactive private identity row with no content", () => {
    expect(sql).toContain("'curated'");
    expect(sql).toContain("'writing'");
    expect(sql).toContain("p_item_number, 2, null, '', '', null, null, null, null, '{}'::text[], 'draft', 'pending', 'private', 'inactive', 'canonical_identity_anchor'");
    expect(sql).toContain("materials");
    expect(sql).toContain("answer_key");
    expect(sql).toContain("rubric");
    expect(sql).toContain("explanation");
  });

  it("never overwrites a colliding row and validates its identity", () => {
    expect(sql).toContain(
      "p_problem_id is distinct from (md5(p_question_id))::uuid",
    );
    expect(sql).toContain(
      "problem_id must equal deterministic learner_problem_id",
    );
    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).not.toContain("on conflict (id) do update");
    expect(sql).toContain("problem_id collision: expected writing domain");
    expect(sql).toContain("problem_id collision: item_number mismatch");
    expect(sql).toContain("problem_id collision: expected curated source");
  });

  it("retains identity rows on rollback", () => {
    const down = readFileSync(downMigrationPath, "utf8").toLowerCase();
    expect(down).toContain("drop function if exists");
    expect(down).not.toMatch(/delete\s+from/);
    expect(down).not.toMatch(/drop\s+table/);
  });
});
