import { describe, expect, it } from "vitest";

import {
  getMissingRequiredProfileFields,
  hasCompletedRequiredProfile,
  normalizeAuthCompletionProfileInput,
  normalizeOptionalProfileInput,
} from "../../../src/lib/auth/profile-completion";

const completeProfile = {
  display_name: "Chan",
  nickname: "talkpik-abc123",
  nationality_country_code: "KR",
  gender: null,
  phone_number: null,
  phone_country_code: null,
};

describe("profile completion helpers", () => {
  it("treats display name, nickname, and supported nationality as required", () => {
    expect(hasCompletedRequiredProfile(completeProfile)).toBe(true);
    expect(getMissingRequiredProfileFields(completeProfile)).toEqual([]);
  });

  it("does not require optional gender or phone number for profile completion", () => {
    expect(
      hasCompletedRequiredProfile({
        ...completeProfile,
        gender: null,
        phone_number: null,
        phone_country_code: null,
      }),
    ).toBe(true);
    expect(
      getMissingRequiredProfileFields({
        ...completeProfile,
        gender: "female",
        phone_number: "01012345678",
        phone_country_code: "KR",
      }),
    ).toEqual([]);
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
      gender: null,
      nickname: "talkpik-min",
      nationality_country_code: "KR",
      phone_country_code: null,
      phone_number: null,
    });
  });

  it("normalizes optional gender and split phone fields without making them required", () => {
    expect(
      normalizeOptionalProfileInput({
        gender: "  FEMALE  ",
        phone_country_code: " kr ",
        phone_number: "  010-1234-5678  ",
      }),
    ).toEqual({
      gender: "female",
      phone_country_code: "KR",
      phone_number: "01012345678",
    });

    expect(
      normalizeOptionalProfileInput({
        gender: "prefer_not_to_say",
        phone_country_code: "zz",
        phone_number: "+82 10 1234 5678",
      }),
    ).toEqual({
      gender: null,
      phone_country_code: null,
      phone_number: "821012345678",
    });

    expect(
      normalizeOptionalProfileInput({
        gender: "",
        phone_country_code: "KR",
        phone_number: "",
      }),
    ).toEqual({
      gender: null,
      phone_country_code: null,
      phone_number: null,
    });
  });
});
