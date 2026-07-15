import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  join(process.cwd(), "scripts", "db", "verify-writing-history-coverage.mjs"),
  "utf8",
).toLowerCase();

describe("verify writing history coverage", () => {
  it("includes submissions with missing writing identities and fails closed", () => {
    expect(script).toContain(
      "left join private.problem_identities identity",
    );
    expect(script).not.toMatch(
      /from public\.writing_submissions submission\s+join private\.problem_identities/,
    );
    expect(script).toContain("missing_identity_count");
    expect(script).toContain("missingidentities !== 0");
  });
});
