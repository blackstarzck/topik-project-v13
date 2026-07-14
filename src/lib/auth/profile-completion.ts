import {
  isSupportedCountryCode,
  normalizeCountryCode,
} from "@/lib/geo/country-codes";

export const PROFILE_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 30;
export const NICKNAME_MAX_LENGTH = 20;
export const PROFILE_GENDERS = ["male", "female"] as const;
export const PHONE_NUMBER_MAX_LENGTH = 20;
export const PHONE_NUMBER_DIGITS_PATTERN = /^\d{1,20}$/;

export type RequiredProfileField =
  | "display_name"
  | "nickname"
  | "nationality_country_code";

export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export type OptionalProfileShape = {
  gender?: ProfileGender | null;
  phone_country_code?: string | null;
  phone_number?: string | null;
};

export type RequiredProfileShape = {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code: string | null;
} & OptionalProfileShape;

export type AuthCompletionProfileInput = {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code: string | null;
  gender: ProfileGender | null;
  phone_country_code: string | null;
  phone_number: string | null;
};

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

function normalizeGender(value: unknown): ProfileGender | null {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return null;
  return PROFILE_GENDERS.includes(normalized as ProfileGender)
    ? (normalized as ProfileGender)
    : null;
}

function normalizePhoneNumber(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const digits = normalized
    .replace(/\D/g, "")
    .slice(0, PHONE_NUMBER_MAX_LENGTH);
  return PHONE_NUMBER_DIGITS_PATTERN.test(digits) ? digits : null;
}

function normalizePhoneCountryCode(
  value: unknown,
  phoneNumber: string | null,
): string | null {
  if (!phoneNumber) return null;
  if (!isSupportedCountryCode(value)) return null;
  return normalizeCountryCode(value);
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
  gender?: unknown;
  phone_country_code?: unknown;
  phone_number?: unknown;
}): AuthCompletionProfileInput {
  return {
    display_name: normalizeText(input.display_name),
    nickname: normalizeText(input.nickname),
    nationality_country_code: isSupportedCountryCode(
      input.nationality_country_code,
    )
      ? normalizeCountryCode(input.nationality_country_code)
      : null,
    ...normalizeOptionalProfileInput(input),
  };
}

export function isRequiredProfileInputValid(
  field: RequiredProfileField,
  input: AuthCompletionProfileInput,
) {
  return isRequiredProfileFieldComplete(field, input);
}

export function normalizeOptionalProfileInput(input: {
  gender?: unknown;
  phone_country_code?: unknown;
  phone_number?: unknown;
}): {
  gender: ProfileGender | null;
  phone_country_code: string | null;
  phone_number: string | null;
} {
  const phoneNumber = normalizePhoneNumber(input.phone_number);
  return {
    gender: normalizeGender(input.gender),
    phone_country_code: normalizePhoneCountryCode(
      input.phone_country_code,
      phoneNumber,
    ),
    phone_number: phoneNumber,
  };
}

export function isOptionalProfileInputValid(input: {
  gender?: unknown;
  phone_country_code?: unknown;
  phone_number?: unknown;
}) {
  const rawGender = normalizeText(input.gender);
  const rawPhoneNumber = normalizeText(input.phone_number);
  return (
    (rawGender === null || normalizeGender(rawGender) !== null) &&
    (rawPhoneNumber === null || normalizePhoneNumber(rawPhoneNumber) !== null)
  );
}
