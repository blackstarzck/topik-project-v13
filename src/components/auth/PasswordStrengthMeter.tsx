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
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: SEGMENT_COUNT }).map((_, index) => {
          const filled = index < strength.score;
          return (
            <div
              key={index}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: filled ? strength.color : "#f0f0f0",
                transition: "background 0.2s ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: strength.color }}>
          {t("label", { level: t(LEVEL_LABEL_KEY[strength.level]) })}
        </Text>
      </div>
      {showRules ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "6px 0 0",
            display: "flex",
            flexWrap: "wrap",
            gap: "2px 12px",
          }}
        >
          {strength.rules.map((rule: PasswordRule) => (
            <li
              key={rule.key}
              style={{
                fontSize: 12,
                color: rule.met ? "#52c41a" : "#8c8c8c",
              }}
            >
              {rule.met ? "✓" : "○"} {t(RULE_LABEL_KEY[rule.key])}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
