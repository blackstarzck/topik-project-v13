"use client";

// Realtime password-strength + rule checklist.
//
// A-01 §3 (비밀번호 강도) and X-06 §3 (규칙 실시간 검증) both ask for a live
// indicator. Renders a 4-segment strength bar plus a per-rule checklist that
// updates as the user types. Pure presentation — scoring lives in
// password-strength.ts so it can be unit-tested without a DOM.

import { Typography } from "antd";
import { useTranslations } from "next-intl";

import {
  evaluatePasswordStrength,
  type PasswordRule,
  type PasswordRuleKey,
  type PasswordStrengthLevel,
} from "./password-strength";

const { Text } = Typography;

// i18n: scoring stays language-free in password-strength.ts; the meter resolves
// display copy here by keying off the level / rule keys.
const LEVEL_LABEL_KEY: Record<
  PasswordStrengthLevel,
  "levelWeak" | "levelFair" | "levelGood" | "levelStrong"
> = {
  weak: "levelWeak",
  fair: "levelFair",
  good: "levelGood",
  strong: "levelStrong",
};

const RULE_LABEL_KEY: Record<
  PasswordRuleKey,
  "ruleLength" | "ruleLowercase" | "ruleUppercase" | "ruleNumber" | "ruleSymbol"
> = {
  length: "ruleLength",
  lowercase: "ruleLowercase",
  uppercase: "ruleUppercase",
  number: "ruleNumber",
  symbol: "ruleSymbol",
};

const LEVEL_BAR_CLASS: Record<PasswordStrengthLevel, string> = {
  weak: "bg-status-error",
  fair: "bg-status-warning",
  good: "bg-status-success",
  strong: "bg-status-strong-success",
};

const LEVEL_TEXT_CLASS: Record<PasswordStrengthLevel, string> = {
  weak: "!text-status-error",
  fair: "!text-status-warning",
  good: "!text-status-success",
  strong: "!text-status-strong-success",
};

type Props = {
  password: string;
  /** Hide until the user has typed at least one char (avoids empty noise). */
  showWhenEmpty?: boolean;
  /** Show the per-rule checklist (X-06 wants the realtime rules visible). */
  showRules?: boolean;
};

const SEGMENT_COUNT = 4;

export function PasswordStrengthMeter({
  password,
  showWhenEmpty = false,
  showRules = true,
}: Props) {
  const t = useTranslations("auth.strength");
  const strength = evaluatePasswordStrength(password);

  if (!password && !showWhenEmpty) return null;

  return (
    <div
      className="password-strength-meter"
      data-testid="password-strength"
      aria-live="polite"
    >
      <div className="flex gap-1">
        {Array.from({ length: SEGMENT_COUNT }).map((_, index) => {
          const filled = index < strength.score;
          return (
            <div
              key={index}
              className={[
                "h-1 flex-1 rounded-indicator",
                filled ? LEVEL_BAR_CLASS[strength.level] : "bg-fill-secondary",
              ].join(" ")}
            />
          );
        })}
      </div>
      <div className="mt-1">
        <Text
          className={["text-xs", LEVEL_TEXT_CLASS[strength.level]].join(" ")}
        >
          {t("label", { level: t(LEVEL_LABEL_KEY[strength.level]) })}
        </Text>
      </div>
      {showRules ? (
        <ul className="mt-1.5 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0">
          {strength.rules.map((rule: PasswordRule) => (
            <li
              key={rule.key}
              className={[
                "text-xs",
                rule.met ? "text-status-success" : "text-text-secondary",
              ].join(" ")}
            >
              {rule.met ? "✓" : "○"} {t(RULE_LABEL_KEY[rule.key])}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
