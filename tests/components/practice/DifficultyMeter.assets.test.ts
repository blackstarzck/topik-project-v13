import { describe, expect, it } from "vitest";

import {
  difficultyIconColorClass,
  difficultyStateAsset,
} from "../../../src/components/practice/DifficultyMeter";

describe("difficulty state assets", () => {
  it("maps five database levels onto three state icons", () => {
    expect(difficultyStateAsset(1)).toBe("/assets/state/difficulty-low.svg");
    expect(difficultyStateAsset(2)).toBe("/assets/state/difficulty-low.svg");
    expect(difficultyStateAsset(3)).toBe("/assets/state/difficulty-middle.svg");
    expect(difficultyStateAsset(4)).toBe("/assets/state/difficulty-high.svg");
    expect(difficultyStateAsset(5)).toBe("/assets/state/difficulty-high.svg");
  });

  it("uses the defined difficulty color scale for icon color classes", () => {
    expect(difficultyIconColorClass(1)).toBe("bg-[#5e9e6f]");
    expect(difficultyIconColorClass(2)).toBe("bg-[#8aa04e]");
    expect(difficultyIconColorClass(3)).toBe("bg-[#cca63a]");
    expect(difficultyIconColorClass(4)).toBe("bg-[#cf833f]");
    expect(difficultyIconColorClass(5)).toBe("bg-[#c75d4f]");
  });
});
