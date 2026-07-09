"use client";

import type { KeyboardEvent, ReactNode } from "react";
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
  callingCodeAriaLabel?: string;
  countryCode?: string | null;
  disabled?: boolean;
  id?: string;
  locale?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCountryCodeChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  value?: string | null;
};

export const PHONE_NUMBER_INPUT_MAX_LENGTH = 20;

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

function normalizePhoneDigits(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, PHONE_NUMBER_INPUT_MAX_LENGTH);
}

function isAllowedPhoneKey(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;

  const keyCode = event.keyCode || event.which;
  return (
    (keyCode >= 48 && keyCode <= 57) ||
    (keyCode >= 96 && keyCode <= 105) ||
    [8, 9, 13, 27, 35, 36, 37, 38, 39, 40, 46].includes(keyCode)
  );
}

export function PhoneNumberInput({
  ariaLabel,
  callingCodeAriaLabel,
  countryCode,
  disabled = false,
  id,
  locale,
  onBlur,
  onChange,
  onCountryCodeChange,
  onFocus,
  placeholder = "1012345678",
  value,
}: PhoneNumberInputProps) {
  const [uncontrolledPhoneCountryCode, setUncontrolledPhoneCountryCode] =
    useState(() =>
      getSupportedPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE),
    );
  const phoneCountryCode = getSupportedPhoneCountryCode(
    countryCode ?? uncontrolledPhoneCountryCode,
  );
  const phoneCountryOptions = useMemo(
    () =>
      createPhoneCountryOptions(
        locale ??
          (typeof navigator === "undefined" ? "en" : navigator.language),
      ),
    [locale],
  );
  const localNumber = normalizePhoneDigits(value ?? "");

  return (
    <div className="grid grid-cols-[minmax(104px,128px)_minmax(0,1fr)] gap-2">
      <Select
        aria-label={callingCodeAriaLabel ?? "Country calling code"}
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
          const normalizedCountryCode =
            getSupportedPhoneCountryCode(nextCountryCode);
          setUncontrolledPhoneCountryCode(normalizedCountryCode);
          onCountryCodeChange?.(normalizedCountryCode);
        }}
        onFocus={onFocus}
      />
      <Input
        id={id}
        aria-label={ariaLabel}
        autoComplete="tel-national"
        disabled={disabled}
        inputMode="numeric"
        maxLength={PHONE_NUMBER_INPUT_MAX_LENGTH}
        pattern="[0-9]*"
        placeholder={placeholder}
        type="tel"
        value={localNumber}
        onBlur={onBlur}
        onChange={(event) => {
          onChange?.(normalizePhoneDigits(event.target.value));
        }}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (!isAllowedPhoneKey(event)) {
            event.preventDefault();
          }
        }}
      />
    </div>
  );
}
