import type { Locale } from "@/i18n/locales";

export const ACCOUNT_DELETION_CONFIRMATION_FIELD = "confirmation";
export const ACCOUNT_DELETION_CONFIRMATION_TEXT = {
  ko: "삭제",
  en: "DELETE",
  vi: "XÓA",
} as const satisfies Record<Locale, string>;

const ACCOUNT_DELETION_CONFIRMATION_VALUES = new Set<string>(
  Object.values(ACCOUNT_DELETION_CONFIRMATION_TEXT),
);

export function isValidAccountDeletionConfirmation(
  value: FormDataEntryValue | null,
): boolean {
  return (
    typeof value === "string" && ACCOUNT_DELETION_CONFIRMATION_VALUES.has(value)
  );
}
