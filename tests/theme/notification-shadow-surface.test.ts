import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

function blockFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("AntD Notification shadow surface", () => {
  test("AntD notification notice uses the shared elevated shadow token", () => {
    expect(
      blockFor(".ant-notification .ant-notification-notice.ant-notification-notice"),
    ).toContain("box-shadow: var(--app-shadow-elevated)");
  });
});
