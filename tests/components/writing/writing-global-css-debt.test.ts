import { describe, expect, test } from "vitest";

import { findGlobalCssOwners } from "./writing-style-contract";

describe("writing global CSS debt", () => {
  test("removes unused writing class families from global.css", () => {
    const unusedClassFamilies = [
      "writing-command",
      "writing-stepper",
      "writing-step",
      "writing-editor-toolbar",
      "writing-answer-card__actions",
      "writing-guide-card--tutor",
      "writing-material-card__cell--empty",
      "writing-material-card__placeholder",
    ];

    expect(
      findGlobalCssOwners(unusedClassFamilies, undefined, {
        includeSuffix: true,
      }),
    ).toEqual([]);
  });
});
