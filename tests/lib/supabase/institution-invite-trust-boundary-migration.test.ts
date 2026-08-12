import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION_PATH = join(
  ROOT,
  "supabase",
  "migrations",
  "20260724130000_institution_invite_trust_boundary.sql",
);

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("institution invitation trust boundary", () => {
  it("removes every reachable raw affiliation-code capture and acceptance path", () => {
    const removedPaths = [
      "src/lib/auth/affiliation-code.ts",
      "src/components/auth/AffiliationCodeCapture.tsx",
      "src/components/auth/ClaimAffiliationRedirect.tsx",
      "src/components/auth/InstitutionInvitePanel.tsx",
      "src/app/auth/institution-invite/page.tsx",
      "src/app/auth/claim-affiliation/page.tsx",
    ];

    for (const path of removedPaths) {
      expect(existsSync(join(ROOT, path)), `${path} must be removed`).toBe(
        false,
      );
    }

    expect(read("src/components/auth/SignUpForm.tsx")).not.toMatch(
      /affiliation[-_ ]code|buildInstitutionInvitePath/i,
    );
    expect(read("src/components/shared/PublicShell.tsx")).not.toContain(
      "AffiliationCodeCapture",
    );
    expect(read("src/lib/auth/oauth.ts")).not.toMatch(
      /build(?:ClaimAffiliation|InstitutionInvite)Path/,
    );
    expect(read("src/lib/routes.ts")).not.toMatch(
      /auth(?:ClaimAffiliation|InstitutionInvite)/,
    );
  });

  it("replaces handle_new_user without trusting affiliation_code metadata", () => {
    expect(existsSync(MIGRATION_PATH), "forward migration is missing").toBe(
      true,
    );

    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function public.handle_new_user()",
    );
    expect(normalized).toContain(
      "phone_country_code text := upper(nullif(btrim(new.raw_user_meta_data->>'phone_country_code'), ''))",
    );
    expect(normalized).toContain(
      "phone_number text := nullif(btrim(new.raw_user_meta_data->>'phone_number'), '')",
    );
    expect(normalized).not.toContain(
      "new.raw_user_meta_data->>'affiliation_code'",
    );
    expect(normalized).not.toContain("v_affiliation_code");
  });

  it("revokes and drops only the two legacy raw-code RPCs", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    for (const signature of [
      "public.accept_affiliation_invite(text, boolean)",
      "public.claim_affiliation_code(text)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role`,
      );
      expect(normalized).toContain(`drop function if exists ${signature}`);
    }

    expect(normalized).not.toContain(
      "drop function if exists private.protect_profile_columns",
    );
    expect(normalized).not.toContain("reset app.claim_affiliation_code");
  });

  it("keeps only the topik-ai-owned invitation response RPC in generated client types", () => {
    const types = read("src/lib/supabase/types.ts");

    expect(types).toContain("respond_institution_invitation");
    expect(types).not.toContain("accept_affiliation_invite");
    expect(types).not.toContain("claim_affiliation_code");
  });

  it("documents the admin/user ownership split and protected GUC compatibility", () => {
    const apiContract = read("docs/supabase/database-api-contract.md");
    const securityContract = read("docs/supabase/security-and-ownership.md");
    const prd = read("docs/prd.md");

    for (const document of [apiContract, securityContract, prd]) {
      expect(document).toContain("topik-ai");
      expect(document).toContain("JWT");
    }
    expect(apiContract).toContain("respond_institution_invitation");
    expect(securityContract).toContain("respond_institution_invitation");

    expect(securityContract).toContain("app.claim_affiliation_code");
    expect(securityContract).toMatch(/transaction-local|트랜잭션/);
  });
});
