import { countries, hasFlag } from "country-flag-icons";

const NON_ISO_REGION_CODES = new Set([
  "AC",
  "EU",
  "IC",
  "TA",
  "XA",
  "XC",
  "XK",
  "XO",
]);

export const ISO_COUNTRY_CODES = countries
  .filter(
    (code) =>
      /^[A-Z]{2}$/.test(code) &&
      !NON_ISO_REGION_CODES.has(code) &&
      hasFlag(code),
  )
  .sort();

const ISO_COUNTRY_CODE_SET = new Set(ISO_COUNTRY_CODES);

function normalizeFieldValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCountryCode(value: unknown) {
  return normalizeFieldValue(value).toUpperCase();
}

export function isSupportedCountryCode(value: unknown) {
  return ISO_COUNTRY_CODE_SET.has(normalizeCountryCode(value));
}
