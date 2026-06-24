import { describe, expect, it } from "vitest";

import {
  getProblemAvailability,
  type ProblemAvailabilityInput,
} from "../../../src/lib/problems/availability";

function row(
  patch: Partial<ProblemAvailabilityInput>,
): ProblemAvailabilityInput {
  return {
    publishStatus: "published",
    visibility: "public",
    lifecycleStatus: "active",
    lifecycleReason: null,
    ...patch,
  };
}

describe("getProblemAvailability", () => {
  it("allows published public active problems", () => {
    expect(getProblemAvailability(row({}))).toEqual({
      state: "available",
      canShowProblemIdentity: true,
      canStart: true,
      canSubmit: true,
      labelKey: null,
      reason: null,
    });
  });

  it("keeps public inactive problems identifiable but blocks start and submit", () => {
    expect(
      getProblemAvailability(
        row({
          lifecycleStatus: "inactive",
          lifecycleReason: "품질 점검 중",
        }),
      ),
    ).toEqual({
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: "품질 점검 중",
    });
  });

  it("keeps public expired problems identifiable but blocks start and submit", () => {
    expect(
      getProblemAvailability(
        row({
          lifecycleStatus: "expired",
          lifecycleReason: null,
        }),
      ),
    ).toEqual({
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: null,
    });
  });

  it("treats archived problems as hard unavailable", () => {
    expect(
      getProblemAvailability(row({ publishStatus: "archived" })),
    ).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });

  it("treats private problems as hard unavailable", () => {
    expect(
      getProblemAvailability(row({ visibility: "private" })),
    ).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });

  it("treats missing problem rows as hard unavailable", () => {
    expect(getProblemAvailability(null)).toMatchObject({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
    });
  });
});
