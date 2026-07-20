import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260718120000_auth_gate_exact_consent_snapshots.sql",
);

function normalizedMigrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

describe("exact auth consent snapshot migration", () => {
  it("locks and compares the current trusted document set before inserting it", () => {
    const sql = normalizedMigrationSql();

    expect(sql).toContain("lock table public.legal_documents in share mode");
    expect(sql).toContain("source_policy_id is not null");
    expect(sql).toContain("is_placeholder is false");
    expect(sql).toContain("jsonb_agg(");
    expect(sql).toContain("order by id");
    expect(sql).toContain(
      "p_consent_documents is distinct from v_expected_consent_documents",
    );
    expect(sql).toContain("jsonb_to_recordset(v_missing_documents)");
    expect(sql).toContain("private.is_email_confirmed(v_user_id)");
  });

  it("publishes only snapshot-aware overloads to authenticated callers", () => {
    const sql = normalizedMigrationSql();

    expect(sql).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, boolean, jsonb) to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb) to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb, text, text) to authenticated",
    );
    expect(sql).toContain(
      "revoke execute on function public.complete_auth_gate(text, text, text, boolean) from authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.complete_auth_gate(text, text, text, boolean) from public",
    );
    expect(sql).toContain(
      "revoke execute on function public.complete_auth_gate(text, text, text, boolean) from anon",
    );
    expect(sql).toContain(
      "revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from authenticated",
    );
    expect(sql).toContain(
      "revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from authenticated",
    );
  });
});
