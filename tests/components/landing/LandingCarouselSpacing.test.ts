import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = join(process.cwd(), "src/styles/global.css");

function blockFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));

  return match?.[1] ?? "";
}

describe("landing carousel spacing styles", () => {
  it("keeps card row spacing off the Swiper wrapper", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(blockFor(css, ".landing-layout-testimonials div")).toBe("");
    expect(
      blockFor(css, ".landing-layout-testimonials article > div"),
    ).toContain("gap: 13px;");
  });
});
