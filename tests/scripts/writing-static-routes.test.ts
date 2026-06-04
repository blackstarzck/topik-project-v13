import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("writing route inventory", () => {
  test("ships D-01 through D-04 as four static app routes", () => {
    for (const segment of ["51", "52", "53", "54"]) {
      expect(
        existsSync(
          join(process.cwd(), `src/app/(workspace)/writing/${segment}/page.tsx`),
        ),
      ).toBe(true);
    }
  });

  test("does not merge D-01 through D-04 behind one dynamic question route", () => {
    expect(
      existsSync(
        join(process.cwd(), "src/app/(workspace)/writing/[questionId]/page.tsx"),
      ),
    ).toBe(false);
  });
});
