// Lightweight, dependency-free password-strength scoring.
//
// Spec drivers:
//   - A-01 §3 / feedback: 비밀번호 강도 표시 (password strength indicator)
//   - X-06 §3: PW 8-64자, 규칙 실시간 검증 (realtime rule validation)
//
// We deliberately avoid pulling a library (zxcvbn etc.) — the coordinator owns
// cross-cutting deps and the i18n workstream. This is a small heuristic that
// rewards length + character-class variety, capped to the 8-64 policy band.

export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

export type PasswordRuleKey =
  | "length"
  | "lowercase"
  | "uppercase"
  | "number"
  | "symbol";

export type PasswordRule = {
  key: PasswordRuleKey;
  label: string;
  met: boolean;
};

export type PasswordStrength = {
  /** 0-4 score used to size the meter. */
  score: number;
  level: PasswordStrengthLevel;
  /** Korean label for the level. */
  levelLabel: string;
  /** antd-compatible status color hint. */
  color: string;
  rules: PasswordRule[];
  /** True when the password satisfies the 8-64 length policy. */
  meetsPolicy: boolean;
};

const LEVEL_LABEL: Record<PasswordStrengthLevel, string> = {
  weak: "약함",
  fair: "보통",
  good: "양호",
  strong: "강함",
};

const LEVEL_COLOR: Record<PasswordStrengthLevel, string> = {
  weak: "#ff4d4f",
  fair: "#faad14",
  good: "#52c41a",
  strong: "#237804",
};

export function evaluatePasswordStrength(
  password: string | undefined | null,
): PasswordStrength {
  const value = password ?? "";

  const rules: PasswordRule[] = [
    { key: "length", label: "8자 이상", met: value.length >= 8 },
    { key: "lowercase", label: "영문 소문자", met: /[a-z]/.test(value) },
    { key: "uppercase", label: "영문 대문자", met: /[A-Z]/.test(value) },
    { key: "number", label: "숫자", met: /[0-9]/.test(value) },
    {
      key: "symbol",
      label: "특수문자",
      met: /[^A-Za-z0-9]/.test(value),
    },
  ];

  // Score: 1 point per satisfied character-class rule (length excluded from
  // variety), plus length bonuses. Clamp to 0-4.
  const varietyMet = rules.filter(
    (rule) => rule.key !== "length" && rule.met,
  ).length;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  score += Math.min(2, Math.max(0, varietyMet - 1));
  score = Math.min(4, score);

  if (value.length === 0) score = 0;

  let level: PasswordStrengthLevel;
  if (score <= 1) level = "weak";
  else if (score === 2) level = "fair";
  else if (score === 3) level = "good";
  else level = "strong";

  const meetsPolicy = value.length >= 8 && value.length <= 64;

  return {
    score,
    level,
    levelLabel: LEVEL_LABEL[level],
    color: LEVEL_COLOR[level],
    rules,
    meetsPolicy,
  };
}
