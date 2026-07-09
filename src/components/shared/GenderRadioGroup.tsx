"use client";

import { Radio, type RadioChangeEvent } from "antd";

import { Check } from "@/components/shared/AppIcons";
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
    "gender-radio-option !m-0 !h-auto !leading-normal flex min-h-12 flex-1 items-center rounded-md border border-solid px-3 py-2 transition-colors",
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
      className="grid w-full grid-cols-2 gap-2"
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
            <span className="flex w-full items-center gap-2">
              <span
                aria-hidden="true"
                className={[
                  "flex size-4 shrink-0 items-center justify-center rounded border border-solid",
                  isSelected
                    ? "border-primary bg-primary text-background"
                    : "border-border bg-background",
                ].join(" ")}
              >
                {isSelected ? <Check size={12} aria-hidden="true" /> : null}
              </span>
              <span>{labels[option]}</span>
            </span>
          </Radio.Button>
        );
      })}
    </Radio.Group>
  );
}
