import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBAL_CSS = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = GLOBAL_CSS.match(
    new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "m"),
  );

  return match?.groups?.body ?? "";
}

describe("brand logo image sizing", () => {
  it("keeps the intrinsic aspect ratio when logo height is changed by CSS", () => {
    const imageRule = cssRule(".brand-logo__image");

    expect(imageRule).toContain("width: auto;");
  });
});
