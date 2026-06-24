import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = join(process.cwd(), "src/styles/global.css");

function blockFor(css: string, selector: string): string {
  const selectorPattern = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/>/g, "\\s*>\\s*");
  const match = css.match(
    new RegExp(`(?:^|\\n)${selectorPattern}\\s*\\{([^}]*)\\}`),
  );

  return match?.[1] ?? "";
}

describe("landing learner goal avatar styles", () => {
  it("renders avatar images inside a padded white circle", () => {
    const css = readFileSync(cssPath, "utf8");
    const avatarBlock = blockFor(css, ".landing-layout-testimonials__avatar");
    const imageBlock = blockFor(
      css,
      ".landing-layout-testimonials__avatar>img",
    );

    expect(avatarBlock).toContain("width: 54px;");
    expect(avatarBlock).toContain("height: 54px;");
    expect(avatarBlock).toContain("flex: 0 0 54px;");
    expect(avatarBlock).toContain("box-sizing: border-box;");
    expect(avatarBlock).toContain("border-radius: 50%;");
    expect(avatarBlock).toContain("background: #ffffff;");
    expect(avatarBlock).toContain("padding: 5px;");

    expect(imageBlock).toContain("border-radius: 50%;");
    expect(imageBlock).toContain("object-fit: contain;");
  });
});
