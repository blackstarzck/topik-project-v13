import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const TYPES_PATH = join(process.cwd(), "src", "lib", "supabase", "types.ts");
const CONTRACT_PATH = join(
  process.cwd(),
  "docs",
  "supabase",
  "database-api-contract.md",
);
const PRD_PATH = join(process.cwd(), "docs", "prd.md");

function readHeadingSection(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";

  const remainder = markdown.slice(start + heading.length);
  const nextHeading = remainder.search(/^#{2,3} /m);
  return nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
}

describe("institution invitation RPC contract evidence", () => {
  it("keeps the shared RPC in the Supabase type snapshot", () => {
    const types = readFileSync(TYPES_PATH, "utf8");

    expect(types).toContain("respond_institution_invitation");
    expect(types).toContain("p_invitation_id: string");
    expect(types).toContain("p_accept: boolean");
  });

  it("records the modal-first notification and external ownership contract", () => {
    const contract = readFileSync(CONTRACT_PATH, "utf8");
    expect(contract).toContain("`institution_invitation`");
    expect(contract).toContain("`invitation_id`");
    expect(contract).toContain("`code_label`");
    expect(contract).toContain("`respond_institution_invitation`");
    expect(contract).toContain("`p_invitation_id`");
    expect(contract).toContain("`p_accept`");
    expect(contract).toContain(
      "20260707141000_institution_invitation_respond.sql",
    );
    expect(contract).toContain(
      "`20260724130000_institution_invite_trust_boundary.sql`",
    );
    expect(contract).toContain("raw-code RPC");
    expect(contract).toContain("`accepted`");
    expect(contract).toContain("`declined`");
    expect(contract).toContain("`code_inactive`");
    expect(contract).toContain("`unauthenticated`");
  });

  it("keeps code_label as a compatible payload field without claiming the modal displays it", () => {
    const contract = readFileSync(CONTRACT_PATH, "utf8");

    expect(contract).toMatch(
      /`code_label`[^.\n]*(?:호환|payload)[^.\n]*(?:표시|노출)하지 않는다/,
    );
    expect(contract).not.toContain(
      "`code`와 `code_label`은 사용자에게 보여 주는 값이다",
    );
  });

  it("keeps invitation accept-or-dismiss behavior in the PRD without duplicating RPC details", () => {
    const prd = readFileSync(PRD_PATH, "utf8");
    const section = readHeadingSection(prd, "### 기관 초대 알림");

    expect(section).toContain("닫기");
    expect(section).toContain("수락");
    expect(section).toMatch(/거부[^.\n]*(?:표시|노출|제공)하지 않는다/);
    expect(section).toMatch(/닫기[^.\n]*응답[^.\n]*(?:보내지|요청하지) 않는다/);
    expect(section).toMatch(/수락[^.\n]*응답/);
    expect(section).not.toMatch(
      /respond_institution_invitation|p_invitation_id|p_accept/,
    );
  });
});
