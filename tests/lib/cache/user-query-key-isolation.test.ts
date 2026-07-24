import { describe, expect, it } from "vitest";

import { recommendationBundleKey } from "../../../src/components/practice/recommendations-data";
import { libraryItemsKey } from "../../../src/lib/library/queries";

describe("learner query cache isolation", () => {
  it("uses a different library cache address for each authenticated user", () => {
    expect(libraryItemsKey("user-a", "problems")).not.toEqual(
      libraryItemsKey("user-b", "problems"),
    );
    expect(libraryItemsKey("user-a", "problems")).toEqual([
      "library-items",
      "user-a",
      "problems",
    ]);
  });

  it("uses a different recommendation cache address for each authenticated user", () => {
    expect(recommendationBundleKey("user-a", 52)).not.toEqual(
      recommendationBundleKey("user-b", 52),
    );
    expect(recommendationBundleKey("user-a", 52)).toEqual([
      "recommendation-bundle",
      "user-a",
      52,
    ]);
  });
});
