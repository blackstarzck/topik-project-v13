"use client";

import { Radio, type RadioChangeEvent } from "antd";

import type { ProfileGender } from "@/lib/auth/profile-completion";

type GenderRadioGroupProps = {
  ariaLabel: string;
  femaleLabel: string;
  maleLabel: string;
  id?: string;
  value?: ProfileGender | null;
  onBlur?: () => void;
  onChange?: (value: ProfileGender | null) => void;
  onFocus?: () => void;
};

const GENDER_OPTIONS: readonly ProfileGender[] = ["male", "female"];

function optionClassName(isSelected: boolean) {
  return [
    "gender-radio-option !m-0 !inline-flex !h-auto min-h-12 min-w-24 !items-center !justify-center rounded-md border border-solid px-4 py-2 text-center !leading-normal transition-colors",
    isSelected
      ? "border-primary bg-background text-text"
      : "border-border bg-background text-text hover:border-primary",
  ].join(" ");
}

export function GenderRadioGroup({
  ariaLabel,
  femaleLabel,
  maleLabel,
  id,
  value,
  onBlur,
  onChange,
  onFocus,
}: GenderRadioGroupProps) {
  const labels: Record<ProfileGender, string> = {
    male: maleLabel,
    female: femaleLabel,
  };

  function handleChange(event: RadioChangeEvent) {
    onChange?.(event.target.value as ProfileGender);
  }

  return (
    <Radio.Group
      id={id}
      aria-label={ariaLabel}
      className="!flex w-full flex-wrap !gap-6"
      value={value ?? undefined}
      onBlur={onBlur}
      onChange={handleChange}
      onFocus={onFocus}
    >
      {GENDER_OPTIONS.map((option) => {
        const isSelected = value === option;
        return (
          <Radio.Button
            key={option}
            value={option}
            className={optionClassName(isSelected)}
            onClick={() => {
              if (isSelected) {
                onChange?.(null);
              }
            }}
          >
            <span>{labels[option]}</span>
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
}
