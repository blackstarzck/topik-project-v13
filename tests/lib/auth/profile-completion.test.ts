import { describe, expect, it } from "vitest";

import {
  getMissingRequiredProfileFields,
  hasCompletedRequiredProfile,
  normalizeAuthCompletionProfileInput,
} from "../../../src/lib/auth/profile-completion";

const completeProfile = {
  display_name: "Chan",
  nickname: "talkpik-abc123",
  nationality_country_code: "KR",
};

describe("profile completion helpers", () => {
  it("treats display name, nickname, and supported nationality as required", () => {
    expect(hasCompletedRequiredProfile(completeProfile)).toBe(true);
    expect(getMissingRequiredProfileFields(completeProfile)).toEqual([]);
  });

  it("reports only the profile fields that are blank or invalid", () => {
    expect(
      getMissingRequiredProfileFields({
        display_name: " ",
        nickname: "t",
        nationality_country_code: "ZZ",
      }),
    ).toEqual(["display_name", "nickname", "nationality_country_code"]);
  });

  it("normalizes form input by trimming strings and uppercasing country codes", () => {
    expect(
      normalizeAuthCompletionProfileInput({
        display_name: "  민준  ",
        nickname: "  talkpik-min  ",
        nationality_country_code: " kr ",
      }),
    ).toEqual({
      display_name: "민준",
      nickname: "talkpik-min",
      nationality_country_code: "KR",
    });
  });
});
