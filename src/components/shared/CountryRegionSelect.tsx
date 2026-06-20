"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { useMemo } from "react";
import { Select } from "antd";
import { countries, hasFlag } from "country-flag-icons";
import * as FlagIcons from "country-flag-icons/react/3x2";

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

const ISO_COUNTRY_CODES = countries
  .filter(
    (code) =>
      /^[A-Z]{2}$/.test(code) &&
      !NON_ISO_REGION_CODES.has(code) &&
      hasFlag(code),
  )
  .sort();

const ISO_COUNTRY_CODE_SET = new Set(ISO_COUNTRY_CODES);

type CountryFlagComponent = ComponentType<
  SVGProps<SVGSVGElement> & { title?: string }
>;

const COUNTRY_FLAG_ICONS = FlagIcons as Record<
  string,
  CountryFlagComponent | undefined
>;

type CountryRegionOption = {
  value: string;
  label: ReactNode;
  countryName: string;
  searchText: string;
};

type CountryRegionSelectProps = {
  locale: string;
  ariaLabel: string;
  placeholder: string;
  value?: string | null;
  id?: string;
  dataTestId?: string;
  allowClear?: boolean;
  disabled?: boolean;
  onChange?: (value: string | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

function normalizeFieldValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCountryCode(value: unknown) {
  return normalizeFieldValue(value).toUpperCase();
}

export function isSupportedCountryCode(value: unknown) {
  return ISO_COUNTRY_CODE_SET.has(normalizeCountryCode(value));
}

function CountryFlag({
  code,
  countryName,
}: {
  code: string;
  countryName: string;
}) {
  const FlagIcon = COUNTRY_FLAG_ICONS[code];
  if (!FlagIcon) {
    return (
      <span className="w-6 shrink-0 text-xs font-medium text-neutral-500">
        {code}
      </span>
    );
  }

  return <FlagIcon title={countryName} className="h-4 w-6 shrink-0" />;
}

function CountryRegionOptionLabel({
  code,
  countryName,
}: {
  code: string;
  countryName: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <CountryFlag code={code} countryName={countryName} />
      <span className="min-w-0 flex-1 truncate">{countryName}</span>
      <span className="shrink-0 text-xs text-neutral-500">{code}</span>
    </span>
  );
}

function createCountryRegionOptions(locale: string): CountryRegionOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);

  return ISO_COUNTRY_CODES.map((code) => {
    const countryName = names.of(code) ?? code;
    return {
      value: code,
      countryName,
      searchText: `${countryName} ${code}`,
      label: <CountryRegionOptionLabel code={code} countryName={countryName} />,
    };
  }).sort((a, b) => collator.compare(a.countryName, b.countryName));
}

export function CountryRegionSelect({
  locale,
  ariaLabel,
  placeholder,
  value,
  id,
  dataTestId,
  allowClear = false,
  disabled = false,
  onChange,
  onFocus,
  onBlur,
}: CountryRegionSelectProps) {
  const countryRegionOptions = useMemo(
    () => createCountryRegionOptions(locale),
    [locale],
  );

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      showSearch
      allowClear={allowClear}
      disabled={disabled}
      virtual={false}
      value={value ?? undefined}
      options={countryRegionOptions}
      placeholder={placeholder}
      filterOption={(input, option) => {
        const searchText =
          (option as CountryRegionOption | undefined)?.searchText ?? "";
        return searchText.toLowerCase().includes(input.trim().toLowerCase());
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(nextValue) => {
        onChange?.(typeof nextValue === "string" ? nextValue : null);
      }}
    />
  );
}
