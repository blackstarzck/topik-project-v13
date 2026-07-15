import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName =
  "20260714160000_writing_snapshot_constraint_execution_fix.sql";
const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");
const down = readFileSync(
  join(process.cwd(), "supabase", "migrations", "down", migrationName),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("writing snapshot constraint execution fix migration", () => {
  it("permits only authenticated server-side writers to evaluate the immutable check", () => {
    expect(sql).toContain(
      "grant execute on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from anon",
    );
    expect(sql).toContain("v_volatility is distinct from 'i'");
    expect(sql).toContain("writing_snapshot_classifier_missed_forbidden_material");
  });

  it("reverses the narrow grants without changing snapshot data", () => {
    expect(down).toContain(
      "revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from authenticated",
    );
    expect(down).toContain(
      "revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from service_role",
    );
    expect(down).not.toContain("update public.writing_drafts");
    expect(down).not.toContain("update public.writing_submissions");
  });
});
