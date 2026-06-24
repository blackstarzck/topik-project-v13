import {
  isSupportedCountryCode,
  normalizeCountryCode,
} from "@/lib/geo/country-codes";

export const PROFILE_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 30;
export const NICKNAME_MAX_LENGTH = 20;

export type RequiredProfileField =
  | "display_name"
  | "nickname"
  | "nationality_country_code";

export type RequiredProfileShape = {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code: string | null;
};

export type AuthCompletionProfileInput = RequiredProfileShape;

const REQUIRED_PROFILE_FIELDS: readonly RequiredProfileField[] = [
  "display_name",
  "nickname",
  "nationality_country_code",
] as const;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isValidDisplayName(value: unknown) {
  const normalized = normalizeText(value);
  return (
    normalized !== null &&
    normalized.length >= PROFILE_NAME_MIN_LENGTH &&
    normalized.length <= DISPLAY_NAME_MAX_LENGTH
  );
}

function isValidNickname(value: unknown) {
  const normalized = normalizeText(value);
  return (
    normalized !== null &&
    normalized.length >= PROFILE_NAME_MIN_LENGTH &&
    normalized.length <= NICKNAME_MAX_LENGTH
  );
}

function isRequiredProfileFieldComplete(
  field: RequiredProfileField,
  profile: RequiredProfileShape,
) {
  switch (field) {
    case "display_name":
      return isValidDisplayName(profile.display_name);
    case "nickname":
      return isValidNickname(profile.nickname);
    case "nationality_country_code":
      return isSupportedCountryCode(profile.nationality_country_code);
  }
}

export function getMissingRequiredProfileFields(
  profile: RequiredProfileShape,
): RequiredProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter(
    (field) => !isRequiredProfileFieldComplete(field, profile),
  );
}

export function hasCompletedRequiredProfile(profile: RequiredProfileShape) {
  return getMissingRequiredProfileFields(profile).length === 0;
}

export function normalizeAuthCompletionProfileInput(input: {
  display_name?: unknown;
  nickname?: unknown;
  nationality_country_code?: unknown;
}): AuthCompletionProfileInput {
  return {
    display_name: normalizeText(input.display_name),
    nickname: normalizeText(input.nickname),
    nationality_country_code: isSupportedCountryCode(
      input.nationality_country_code,
    )
      ? normalizeCountryCode(input.nationality_country_code)
      : null,
  };
}

export function isRequiredProfileInputValid(
  field: RequiredProfileField,
  input: AuthCompletionProfileInput,
) {
  return isRequiredProfileFieldComplete(field, input);
}
