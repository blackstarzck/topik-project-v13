import { describe, expect, it } from "vitest";

import { findClassOwners, hasExactCssRule } from "./writing-style-contract";

describe("writing style contract helpers", () => {
  it("matches declarations structurally without depending on comments or order", () => {
    expect(
      hasExactCssRule(
        `.panel { width: 320px; /* order is irrelevant */ display: flex; }
        .unrelated { display: block; }`,
        ".panel",
        "display: flex; width: 320px;",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        `.panel, .other { display: flex; width: 320px; }`,
        ".panel",
        "display: flex; width: 320px;",
      ),
    ).toBe(false);
  });

  it("finds stable classes inside compound, nested, and attribute selectors", () => {
    const source = `
      .writing-panel.compact { display: grid; }
      :where(.writing-title) { margin: 0; }
      body { & .writing-meta { display: block; } }
      [class~="writing-tabs"] { overflow: auto; }
    `;

    expect(
      findClassOwners(source, [
        "writing-panel",
        "writing-title",
        "writing-meta",
        "writing-tabs",
      ]),
    ).toEqual([
      ".writing-panel.compact",
      ":where(.writing-title)",
      "& .writing-meta",
      '[class~="writing-tabs"]',
    ]);
  });
});
