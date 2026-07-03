import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import vi from "../../../messages/vi.json";

/** Flatten a nested message object into dotted key paths. */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("message catalog parity", () => {
  const koKeys = keyPaths(ko).sort();

  it("en.json has exactly the same key set as the ko baseline", () => {
    expect(keyPaths(en).sort()).toEqual(koKeys);
  });

  it("vi.json has exactly the same key set as the ko baseline", () => {
    expect(keyPaths(vi).sort()).toEqual(koKeys);
  });

  it("no catalog has an empty string value", () => {
    for (const [name, cat] of [
      ["ko", ko],
      ["en", en],
      ["vi", vi],
    ] as const) {
      const empties = keyPaths(cat).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (acc, seg) => (acc as Record<string, unknown>)?.[seg],
            cat,
          );
        return value === "";
      });
      expect(
        empties,
        `${name} has empty values: ${empties.join(", ")}`,
      ).toEqual([]);
    }
  });
});
