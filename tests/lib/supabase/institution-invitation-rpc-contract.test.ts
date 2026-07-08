import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const TYPES_PATH = join(process.cwd(), "src", "lib", "supabase", "types.ts");
const CONTRACT_PROPOSAL_PATH = join(
  process.cwd(),
  "docs",
  "sot-change-proposals",
  "2026-07-08-institution-invitation-modal-contract.md",
);

describe("institution invitation RPC contract evidence", () => {
  it("keeps the shared RPC in the Supabase type snapshot", () => {
    const types = readFileSync(TYPES_PATH, "utf8");

    expect(types).toContain("respond_institution_invitation");
    expect(types).toContain("p_invitation_id: string");
    expect(types).toContain("p_accept: boolean");
  });

  it("records the modal-first notification contract as a SOT change proposal", () => {
    expect(
      existsSync(CONTRACT_PROPOSAL_PATH),
      "institution invitation modal contract proposal is missing",
    ).toBe(true);

    const proposal = readFileSync(CONTRACT_PROPOSAL_PATH, "utf8");
    expect(proposal).toContain("template_key = `institution_invitation`");
    expect(proposal).toContain("respond_institution_invitation");
    expect(proposal).toContain(
      "20260707141000_institution_invitation_respond.sql",
    );
    expect(proposal).toContain("v13 migration을 추가하지 않는다");
  });
});
