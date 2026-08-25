import { describe, expect, it } from "vitest";

import {
  findClassOwners,
  hasStableAndScopedClasses,
  hasExactCssRule,
} from "./writing-style-contract";

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

  it("finds stable classes inside compound, nested, and operator-specific attribute selectors", () => {
    const source = `
      .writing-panel.compact { display: grid; }
      :where(.writing-title) { margin: 0; }
      body { & .writing-meta { display: block; } }
      [class~="writing-tabs"] { overflow: auto; }
      [class="writing-equal utility"] { display: grid; }
      [class|="writing-pipe"] { display: grid; }
      [class^="writing-prefix"] { display: grid; }
      [class$="suffix-panel"] { display: grid; }
      [class*="middle-fragment"] { display: grid; }
      [class="foo-writing-panel"] { display: none; }
    `;

    expect(
      findClassOwners(source, [
        "writing-panel",
        "writing-title",
        "writing-meta",
        "writing-tabs",
        "writing-equal",
        "writing-pipe",
        "writing-prefix-panel",
        "writing-suffix-panel",
        "writing-middle-fragment-panel",
      ]),
    ).toEqual([
      ".writing-panel.compact",
      ":where(.writing-title)",
      "& .writing-meta",
      '[class~="writing-tabs"]',
      '[class="writing-equal utility"]',
      '[class|="writing-pipe"]',
      '[class^="writing-prefix"]',
      '[class$="suffix-panel"]',
      '[class*="middle-fragment"]',
    ]);

    expect(
      findClassOwners(
        '[class="writing-command-bar"] { display: grid; }',
        ["writing-command"],
        { includeSuffix: true },
      ),
    ).toEqual(['[class="writing-command-bar"]']);
  });

  it("requires the exact imported module class beside the stable class", () => {
    const element = (classNames: string[]) =>
      ({
        classList: {
          contains: (className: string) => classNames.includes(className),
        },
      }) as unknown as Element;

    expect(
      hasStableAndScopedClasses(
        element(["writing-panel", "WritingPanel-module__abc__panel"]),
        "writing-panel",
        "WritingPanel-module__abc__panel",
      ),
    ).toBe(true);
    expect(
      hasStableAndScopedClasses(
        element(["writing-panel", "css-dev-only-do-not-override-abc"]),
        "writing-panel",
        "WritingPanel-module__abc__panel",
      ),
    ).toBe(false);
  });
});
