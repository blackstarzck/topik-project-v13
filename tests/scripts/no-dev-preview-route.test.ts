import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("app route inventory", () => {
  test("does not ship the old dev preview dashboard route", () => {
    expect(
      existsSync(join(process.cwd(), "src/app/dev-preview/dashboard/page.tsx")),
    ).toBe(false);
  });
});
