import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const launcherCss = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "shared",
    "SystemReportLauncher.module.css",
  ),
  "utf8",
);

function blockFor(css: string, selector: string): string {
  const escaped = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("system report popover layout", () => {
  test("keeps the launcher elevated and constrains the popover to the viewport", () => {
    expect(blockFor(launcherCss, ".launcher:global(.ant-float-btn)")).toContain(
      "box-shadow: var(--app-shadow-elevated)",
    );

    const root = blockFor(
      launcherCss,
      ":global(.app-system-report-popover.ant-popover)",
    );
    expect(root).toContain("width:");
    expect(root).toMatch(/calc\(\s*100%\s*-/);

    const container = blockFor(
      launcherCss,
      ":global(.app-system-report-popover__container)",
    );
    expect(container).toContain("width: 100%");
    expect(container).toContain("max-height:");
    expect(container).toContain("overflow: hidden auto");
    expect(container).toContain("scrollbar-width: none");
  });
});
