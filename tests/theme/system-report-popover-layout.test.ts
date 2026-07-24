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
const providersSource = readFileSync(
  join(process.cwd(), "src", "app", "providers.tsx"),
  "utf8",
);
const rootLayoutSource = readFileSync(
  join(process.cwd(), "src", "app", "layout.tsx"),
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
  test("mounts the global launcher in client providers without changing the server layout", () => {
    expect(providersSource).toContain("<SystemReportLauncher />");
    expect(rootLayoutSource).not.toContain("SystemReportLauncher");
  });

  test("uses the shared elevated shadow on the launcher", () => {
    const launcher = blockFor(
      launcherCss,
      ".launcher:global(.ant-float-btn.ant-float-btn-individual)",
    );
    expect(launcher).toContain("box-shadow: var(--app-shadow-elevated)");
  });

  test("constrains the popover to the viewport", () => {
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
