import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("workspace AppCard border token", () => {
  test("bordered workspace cards use the shared app border token", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src", "styles", "global.css"),
      "utf8",
    );

    const match = css.match(
      /\.app-cards-bordered\s+\.app-card\.app-surface\s*\{([^}]+)\}/,
    );
    const ruleBody = match?.[1];

    expect(ruleBody).toBeTruthy();
    expect(ruleBody).toContain(
      "border: 1px solid var(--app-color-border);",
    );
    expect(ruleBody).not.toContain("var(--ant-color-border-secondary)");
  });
});
