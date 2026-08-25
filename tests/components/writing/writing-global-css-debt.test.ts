import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("writing global CSS debt", () => {
  test("removes unused writing class families from global.css", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "styles", "global.css"),
      "utf8",
    );
    const unusedClassFamilies = [
      ".writing-command",
      ".writing-stepper",
      ".writing-step",
      ".writing-editor-toolbar",
      ".writing-answer-card__actions",
      ".writing-guide-card--tutor",
      ".writing-material-card__cell--empty",
      ".writing-material-card__placeholder",
    ];

    for (const classFamily of unusedClassFamilies) {
      expect(css).not.toContain(classFamily);
    }
  });
});
