import { describe, expect, test } from "vitest";

import { sharedComponentTokens } from "../../src/theme/components/shared";
import { getAppTheme } from "../../src/theme";

const sharedSelectTokens = {
  optionActiveBg:
    "color-mix(in srgb, var(--ant-color-bg-layout) 70%, var(--ant-color-bg-container))",
  optionSelectedBg: "var(--ant-color-bg-layout)",
  optionSelectedColor: "var(--ant-color-text)",
  optionSelectedFontWeight: 500,
};

describe("shared Select component token source", () => {
  test("uses only resolved Ant Design global CSS token variables", () => {
    expect(sharedComponentTokens.Select).toEqual(sharedSelectTokens);
    expect(JSON.stringify(sharedComponentTokens.Select)).not.toContain(
      "--app-",
    );
  });

  test("keeps the shared Select tokens in every built theme", () => {
    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(
          getAppTheme(themeName, appearance).antd.components?.Select,
        ).toEqual(expect.objectContaining(sharedSelectTokens));
      }
    }
  });
});
