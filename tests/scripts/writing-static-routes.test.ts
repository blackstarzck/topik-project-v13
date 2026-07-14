import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("writing route inventory", () => {
  test("ships D-01 through D-04 as four static question-specific app routes", () => {
    for (const segment of [
      "short-answer-writing-51",
      "answer-writing-52",
      "long-form-writing-53",
      "essay-writing-54",
    ]) {
      expect(
        existsSync(
          join(process.cwd(), `src/app/(workspace)/writing/${segment}/page.tsx`),
        ),
      ).toBe(true);
    }
  });

  test("does not expose numeric or dynamic writing page route folders", () => {
    for (const segment of ["51", "52", "53", "54"]) {
      expect(
        existsSync(
          join(process.cwd(), `src/app/(workspace)/writing/${segment}/page.tsx`),
        ),
      ).toBe(false);
    }

    expect(
      existsSync(
        join(process.cwd(), "src/app/(workspace)/writing/[questionId]/page.tsx"),
      ),
    ).toBe(false);
  });
});
