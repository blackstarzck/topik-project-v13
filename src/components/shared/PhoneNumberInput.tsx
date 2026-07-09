"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Input, Select } from "antd";
import { CountryFlag } from "@/components/shared/CountryRegionSelect";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_PHONE_COUNTRY_CODE,
  getCountryCallingCode,
} from "@/lib/geo/country-calling-codes";
import {
  ISO_COUNTRY_CODES,
  normalizeCountryCode,
} from "@/lib/geo/country-codes";

type PhoneCountryOption = {
  value: string;
  label: ReactNode;
  countryName: string;
  dialCode: string;
  searchText: string;
};

type PhoneNumberInputProps = {
  ariaLabel: string;
  countryCode?: string | null;
  disabled?: boolean;
  id?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  value?: string | null;
};

function PhoneCountryOptionLabel({
  code,
  countryName,
  dialCode,
}: {
  code: string;
  countryName: string;
  dialCode: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CountryFlag code={code} countryName={countryName} />
      <span className="shrink-0 font-medium">{dialCode}</span>
    </span>
  );
}

function createPhoneCountryOptions(locale: string): PhoneCountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);

  return ISO_COUNTRY_CODES.flatMap((code) => {
    const dialCode = COUNTRY_CALLING_CODES[code];
    if (!dialCode) return [];
    const countryName = names.of(code) ?? code;
    return {
      value: code,
      countryName,
      dialCode,
      searchText: `${countryName} ${code} ${dialCode}`,
      label: (
        <PhoneCountryOptionLabel
          code={code}
          countryName={countryName}
          dialCode={dialCode}
        />
      ),
    };
  }).sort((a, b) => collator.compare(a.countryName, b.countryName));
}

function getSupportedPhoneCountryCode(countryCode: string | null | undefined) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  return getCountryCallingCode(normalizedCountryCode)
    ? normalizedCountryCode
    : DEFAULT_PHONE_COUNTRY_CODE;
}

function composePhoneNumber(dialCode: string, localNumber: string) {
  const trimmedLocalNumber = localNumber.trim();
  if (trimmedLocalNumber.length === 0) return "";

  if (trimmedLocalNumber.startsWith("+")) {
    const internationalDigits = trimmedLocalNumber.replace(/[^\d]/g, "");
    return internationalDigits.length > 0 ? `+${internationalDigits}` : "";
  }

  const nationalDigits = trimmedLocalNumber
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");
  return nationalDigits.length > 0 ? `${dialCode}${nationalDigits}` : "";
}

export function PhoneNumberInput({
  ariaLabel,
  countryCode,
  disabled = false,
  id,
  onBlur,
  onChange,
  onFocus,
  placeholder = "1012345678",
}: PhoneNumberInputProps) {
  const [phoneCountryCodeOverride, setPhoneCountryCodeOverride] = useState<
    string | null
  >(null);
  const [localNumber, setLocalNumber] = useState("");
  const phoneCountryOptions = useMemo(
    () =>
      createPhoneCountryOptions(
        typeof navigator === "undefined" ? "en" : navigator.language,
      ),
    [],
  );
  const phoneCountryCode =
    phoneCountryCodeOverride ?? getSupportedPhoneCountryCode(countryCode);
  const dialCode =
    getCountryCallingCode(phoneCountryCode) ??
    getCountryCallingCode(DEFAULT_PHONE_COUNTRY_CODE) ??
    "+82";

  function emitPhoneNumber(nextCountryCode: string, nextLocalNumber: string) {
    const nextDialCode =
      getCountryCallingCode(nextCountryCode) ??
      getCountryCallingCode(DEFAULT_PHONE_COUNTRY_CODE) ??
      "+82";
    onChange?.(composePhoneNumber(nextDialCode, nextLocalNumber));
  }

  return (
    <div className="grid grid-cols-[minmax(104px,128px)_minmax(0,1fr)] gap-2">
      <Select
        aria-label="Country calling code"
        className="min-w-0"
        data-testid="phone-country-code-select"
        disabled={disabled}
        optionLabelProp="label"
        options={phoneCountryOptions}
        popupMatchSelectWidth={180}
        showSearch
        value={phoneCountryCode}
        virtual={false}
        filterOption={(input, option) => {
          const searchText =
            (option as PhoneCountryOption | undefined)?.searchText ?? "";
          return searchText.toLowerCase().includes(input.trim().toLowerCase());
        }}
        onBlur={onBlur}
        onChange={(nextCountryCode) => {
          const normalizedCountryCode = getSupportedPhoneCountryCode(
            nextCountryCode,
          );
          setPhoneCountryCodeOverride(normalizedCountryCode);
          emitPhoneNumber(normalizedCountryCode, localNumber);
        }}
        onFocus={onFocus}
      />
      <Input
        id={id}
        aria-label={ariaLabel}
        autoComplete="tel-national"
        disabled={disabled}
        inputMode="tel"
        placeholder={placeholder}
        value={localNumber}
        onBlur={onBlur}
        onChange={(event) => {
          const nextLocalNumber = event.target.value;
          setLocalNumber(nextLocalNumber);
          onChange?.(composePhoneNumber(dialCode, nextLocalNumber));
        }}
        onFocus={onFocus}
      />
    </div>
  );
}
