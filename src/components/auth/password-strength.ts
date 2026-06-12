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

// i18n: this module is not a component and cannot call useTranslations, so it
// carries NO display copy. Each rule exposes only its locale-free `key`; the
// rendering component (PasswordStrengthMeter) maps that key to the
// `auth.strength.rule*` catalog and resolves the label via t().
export type PasswordRule = {
  key: PasswordRuleKey;
  met: boolean;
};

export type PasswordStrength = {
  /** 0-4 score used to size the meter. */
  score: number;
  /** Locale-free level key; the meter resolves the label via auth.strength.level*. */
  level: PasswordStrengthLevel;
  rules: PasswordRule[];
  /** True when the password satisfies the 8-64 length policy. */
  meetsPolicy: boolean;
};

export function evaluatePasswordStrength(
  password: string | undefined | null,
): PasswordStrength {
  const value = password ?? "";

  const rules: PasswordRule[] = [
    { key: "length", met: value.length >= 8 },
    { key: "lowercase", met: /[a-z]/.test(value) },
    { key: "uppercase", met: /[A-Z]/.test(value) },
    { key: "number", met: /[0-9]/.test(value) },
    { key: "symbol", met: /[^A-Za-z0-9]/.test(value) },
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
    rules,
    meetsPolicy,
  };
}
