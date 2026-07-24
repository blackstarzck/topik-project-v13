import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const appModalCss = readFileSync(
  join(process.cwd(), "src", "components", "shared", "AppModal.module.css"),
  "utf8",
);
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

describe("system report floating surfaces", () => {
  test("launcher and panel use the shared elevated shadow token", () => {
    expect(blockFor(launcherCss, ".launcher:global(.ant-float-btn)")).toContain(
      "box-shadow: var(--app-shadow-elevated)",
    );
    expect(
      blockFor(
        appModalCss,
        ".bottomRight :global(.ant-modal .ant-modal-container.ant-modal-container), .bottomRight :global(.ant-modal .ant-modal-content.ant-modal-content)",
      ),
    ).toContain("box-shadow: var(--app-shadow-elevated)");
  });

  test("non-blocking modal root cannot widen or block the page", () => {
    const root = blockFor(appModalCss, ".nonBlocking");

    expect(root).toContain("position: fixed");
    expect(root).toContain("inset: 0");
    expect(root).toContain("overflow: hidden");
    expect(root).toContain("pointer-events: none");
  });
});
