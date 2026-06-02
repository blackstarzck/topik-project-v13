// Phase 8-C · Supabase auth error.code → canonical reason mapping
//
// Codex 3-round PASS consensus (rounds 1-3 in
// tasks/codex-output-auth-error-ux-round{1,2,3}-20260526.md).
// Source list: https://supabase.com/docs/guides/auth/debugging/error-codes
//
// Raw error.code values pass through unchanged when they appear here;
// anything else falls back to 'unknown'. Never expose raw error_description
// to the UI — log it server-side only.

export type AuthErrorReason =
  | "otp_expired"
  | "flow_state_expired"
  | "flow_state_not_found"
  | "bad_code_verifier"
  | "user_not_found"
  | "over_email_send_rate_limit"
  | "over_request_rate_limit"
  | "email_not_confirmed"
  | "signup_disabled"
  | "access_denied"
  | "unknown";

const SUPPORTED_REASONS = new Set<AuthErrorReason>([
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
  "bad_code_verifier",
  "user_not_found",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_not_confirmed",
  "signup_disabled",
  "access_denied",
  "unknown",
]);

export function mapSupabaseErrorCode(code: string | null | undefined): AuthErrorReason {
  if (!code) return "unknown";
  return SUPPORTED_REASONS.has(code as AuthErrorReason)
    ? (code as AuthErrorReason)
    : "unknown";
}

export function isValidReason(value: string | null | undefined): value is AuthErrorReason {
  if (!value) return false;
  return SUPPORTED_REASONS.has(value as AuthErrorReason);
}

export type AuthErrorCtaKind =
  | "resend"
  | "signup"
  | "retry"
  | "login"
  | "home"
  | "help";

// i18n: CTA carries only the routing `kind`. The display label is resolved by
// the consuming component via t(`error.${reason}.primaryLabel` / `secondaryLabel`)
// — see AuthErrorCard. No copy lives in this module.
export type AuthErrorCta = {
  kind: AuthErrorCtaKind;
};

// i18n: title / message / CTA labels are NOT stored here. They live in the
// `auth.error.<reason>.*` catalog (title / message / primaryLabel / secondaryLabel)
// and the consuming component resolves them with a dynamic-key t() call. This
// module cannot call useTranslations, so it only keeps the locale-free shape:
// CTA kinds (for routing) + boolean flags (field/countdown behavior).
export type AuthErrorContent = {
  primary: AuthErrorCta;
  secondary?: AuthErrorCta;
  showsEmailField: boolean;
  hasCountdown: boolean;
};

export const REASON_CONTENT: Record<AuthErrorReason, AuthErrorContent> = {
  otp_expired: {
    primary: { kind: "resend" },
    secondary: { kind: "login" },
    showsEmailField: true,
    // Phase 8 follow-up v2.3 (2026-05-27): 60초 cooldown 실제 활성화.
    // AuthErrorCard가 retry_after_seconds 누락 시 default 60초로 초기화 (component:74).
    hasCountdown: true,
  },
  flow_state_expired: {
    primary: { kind: "retry" },
    secondary: { kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  flow_state_not_found: {
    primary: { kind: "retry" },
    secondary: { kind: "help" },
    showsEmailField: false,
    hasCountdown: false,
  },
  bad_code_verifier: {
    primary: { kind: "retry" },
    showsEmailField: false,
    hasCountdown: false,
  },
  user_not_found: {
    primary: { kind: "signup" },
    secondary: { kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  over_email_send_rate_limit: {
    primary: { kind: "resend" },
    showsEmailField: true,
    hasCountdown: true,
  },
  over_request_rate_limit: {
    primary: { kind: "retry" },
    showsEmailField: false,
    hasCountdown: true,
  },
  email_not_confirmed: {
    primary: { kind: "resend" },
    secondary: { kind: "login" },
    showsEmailField: true,
    hasCountdown: false,
  },
  signup_disabled: {
    primary: { kind: "home" },
    showsEmailField: false,
    hasCountdown: false,
  },
  access_denied: {
    primary: { kind: "signup" },
    secondary: { kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  unknown: {
    primary: { kind: "home" },
    secondary: { kind: "help" },
    showsEmailField: false,
    hasCountdown: false,
  },
};

// next query sanitizer — relative path only.
// Allow: "/dashboard", "/practice/problems"
// Reject: "//evil.com", "https://evil.com", "javascript:..."
export function sanitizeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes(":")) return fallback;
  return value;
}

// Default short cooldown when we know it's a rate-limit-class error but
// can't read the real Retry-After header. supabase-js v2 AuthError exposes
// status only (no response headers), so callback route can't extract the
// real Retry-After. AuthErrorCard already falls back to 60s when the
// retry_after_seconds query is missing; we re-use the same number here so
// the contract is explicit at the source (callback) rather than implicit
// at the card.
export const RATE_LIMIT_FALLBACK_SECONDS = 60;

// Retry-After header value (seconds) sanitizer.
// Accept: positive integer 1..86400
// Reject: NaN, negative, > 86400, decimal
export function sanitizeRetryAfterSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 1 || num > 86400) return null;
  return num;
}

// Phase 8.5 · Parse URL fragment from Supabase implicit flow.
// Input examples:
//   "#error=access_denied&error_code=otp_expired&error_description=..."
//   "#access_token=...&refresh_token=...&token_type=bearer&type=signup"
//   "" or "#"  → returns empty fields
export type ParsedAuthFragment = {
  errorCode: string | null;
  errorDescription: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  type: string | null;
};

export function parseAuthFragment(hash: string | null | undefined): ParsedAuthFragment {
  const empty: ParsedAuthFragment = {
    errorCode: null,
    errorDescription: null,
    accessToken: null,
    refreshToken: null,
    tokenType: null,
    type: null,
  };
  if (!hash) return empty;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return empty;
  const params = new URLSearchParams(trimmed);
  return {
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    tokenType: params.get("token_type"),
    type: params.get("type"),
  };
}
