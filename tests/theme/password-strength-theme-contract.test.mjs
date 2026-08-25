import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { scanUiContract } from "../../scripts/lib/ui-contract.mjs";

const componentPath = "src/components/auth/PasswordStrengthMeter.tsx";

describe("password strength theme consumer contract", () => {
  test("has no arbitrary Tailwind visual values or direct AntD variable chains", () => {
    const content = readFileSync(resolve(process.cwd(), componentPath), "utf8");
    const violations = scanUiContract([
      { path: componentPath, content },
    ]).violations.filter(
      (violation) => violation.ruleId === "tailwind.arbitrary-visual",
    );

    expect(violations).toEqual([]);
    expect(content).not.toContain("var(--ant-");
  });
});
