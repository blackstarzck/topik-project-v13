import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

describe("PasswordResetRequestForm style ownership", () => {
  it("moves both login-return states to a component-owned recipe", async () => {
    const [component, recipe, globalCss] = await Promise.all([
      readFile("src/components/auth/PasswordResetRequestForm.tsx", "utf8"),
      readFile(
        "src/components/auth/PasswordResetRequestForm.module.css",
        "utf8",
      ).catch(() => ""),
      readFile("src/styles/global.css", "utf8"),
    ]);
    const blockStart = globalCss.indexOf(".password-reset-card");
    const blockEnd = globalCss.indexOf("/*\n * X-12", blockStart);
    const resetBlock = globalCss.slice(blockStart, blockEnd);
    const broadOverrides = scanUiContract([
      { path: "src/styles/global.css", content: resetBlock },
    ]).violations.filter(
      (violation) => violation.ruleId === "antd.broad-state-override",
    );

    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(broadOverrides).toEqual([]);
    expect(component).toContain(
      'import styles from "./PasswordResetRequestForm.module.css";',
    );
    expect(component.match(/className=\{styles\.loginReturn\}/gu)).toHaveLength(
      2,
    );
    expect(
      component.match(/className=\{styles\.loginReturnLink\}/gu),
    ).toHaveLength(2);
    expect(recipe).toMatch(
      /\.loginReturn:global\(\.ant-typography\)\s*\{[\s\S]*?margin:\s*14px 0 0;[\s\S]*?line-height:\s*1\.5;[\s\S]*?text-align:\s*center;/u,
    );
    expect(recipe).toMatch(
      /\.loginReturn\s+\.loginReturnLink\s*\{[\s\S]*?color:\s*var\(--app-color-text-secondary\);[\s\S]*?font-size:\s*var\(--app-font-size-body-lg\);[\s\S]*?font-weight:\s*400;[\s\S]*?text-decoration:\s*none;/u,
    );
    expect(recipe).toMatch(
      /\.loginReturn\s+\.loginReturnLink:hover\s*\{[\s\S]*?color:\s*var\(--app-color-text\);[\s\S]*?text-decoration:\s*underline;/u,
    );
    expect(recipe).not.toMatch(/outline:\s*none/iu);
    expect(globalCss).not.toContain(".password-reset-login-return");
  });
});
