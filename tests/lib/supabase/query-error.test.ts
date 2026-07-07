import { describe, expect, it } from "vitest";
import { throwIfQueryError } from "../../../src/lib/supabase/query-error";

describe("throwIfQueryError", () => {
  it("does nothing when the query succeeded (error: null)", () => {
    expect(() => throwIfQueryError("label", { error: null })).not.toThrow();
  });

  it("throws a labeled error so page-level catch can show the retry screen", () => {
    expect(() =>
      throwIfQueryError("loadGrowthData(writing_feedback)", {
        error: { message: "connection refused" },
      }),
    ).toThrow("loadGrowthData(writing_feedback): connection refused");
  });
});
