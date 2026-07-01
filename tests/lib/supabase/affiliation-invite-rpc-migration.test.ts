import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readAffiliationInviteMigration() {
  const migrationDir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(migrationDir).find((name) => {
    if (!name.endsWith(".sql")) return false;
    const path = join(migrationDir, name);
    if (!existsSync(path)) return false;
    return readFileSync(path, "utf8").includes("accept_affiliation_invite");
  });

  expect(file, "accept_affiliation_invite migration is missing").toBeDefined();

  const path = join(migrationDir, file ?? "");
  return {
    file,
    sql: readFileSync(path, "utf8"),
  };
}

describe("accept_affiliation_invite migration", () => {
  it("requires explicit confirmation before writing affiliation_code", () => {
    const { sql } = readAffiliationInviteMigration();

    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.accept_affiliation_invite\s*\(\s*p_code\s+text\s*,\s*p_confirmed\s+boolean/im,
    );
    expect(sql).toMatch(/p_confirmed\s+is\s+distinct\s+from\s+true/im);
    expect(sql).toMatch(/return\s+jsonb_build_object\(\s*'status'\s*,\s*'failed'/im);
  });

  it("uses the authenticated caller and keeps the security definer function locked down", () => {
    const { sql } = readAffiliationInviteMigration();

    expect(sql).toMatch(/security\s+definer/im);
    expect(sql).toMatch(/set\s+search_path\s*=\s*pg_catalog\s*,\s*public/im);
    expect(sql).toMatch(/v_caller_id\s+uuid\s*:=\s*\(select\s+auth\.uid\(\)\)/im);
    expect(sql).toMatch(/if\s+v_caller_id\s+is\s+null\s+then/im);
    expect(sql).toMatch(/status\s*=\s*'active'/im);
    expect(sql).toMatch(/set_config\(\s*'app\.claim_affiliation_code'\s*,\s*'1'\s*,\s*true\s*\)/im);
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_affiliation_invite\s*\(\s*text\s*,\s*boolean\s*\)\s+from\s+public/im,
    );
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_affiliation_invite\s*\(\s*text\s*,\s*boolean\s*\)\s+from\s+anon/im,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.accept_affiliation_invite\s*\(\s*text\s*,\s*boolean\s*\)\s+to\s+authenticated/im,
    );
  });

  it("returns the invite status enum expected by the client", () => {
    const { sql } = readAffiliationInviteMigration();

    for (const status of [
      "accepted",
      "invalid",
      "already_affiliated_same",
      "already_affiliated_other",
      "profile_not_found",
      "failed",
    ]) {
      expect(sql).toContain(status);
    }
  });

  it("does not switch an account that already has another affiliation", () => {
    const { sql } = readAffiliationInviteMigration();

    expect(sql).toMatch(
      /if\s+v_current_code\s+is\s+not\s+null\s+then[\s\S]+already_affiliated_other[\s\S]+end\s+if;/im,
    );
    expect(sql).toMatch(
      /where\s+id\s*=\s*v_caller_id[\s\S]+affiliation_code\s+is\s+null[\s\S]+affiliation_code\s*=\s*''/im,
    );
  });

  it("keeps the legacy claim_affiliation_code function as a compatibility wrapper", () => {
    const { sql } = readAffiliationInviteMigration();

    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.claim_affiliation_code/im);
    expect(sql).toMatch(/accept_affiliation_invite\(\s*p_code\s*,\s*true\s*\)/im);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.accept_affiliation_invite/im);
  });
});
