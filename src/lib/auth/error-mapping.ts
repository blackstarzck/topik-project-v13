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

export type AuthErrorCta = {
  label: string;
  kind: AuthErrorCtaKind;
};

export type AuthErrorContent = {
  title: string;
  message: string;
  primary: AuthErrorCta;
  secondary?: AuthErrorCta;
  showsEmailField: boolean;
  hasCountdown: boolean;
};

export const REASON_CONTENT: Record<AuthErrorReason, AuthErrorContent> = {
  otp_expired: {
    title: "인증 링크가 만료됐어요",
    message:
      "이메일을 다시 입력하면 새 인증 메일을 보내드릴게요. 메일은 60초 안에 한 번만 보낼 수 있어요.",
    primary: { label: "인증 메일 다시 받기", kind: "resend" },
    secondary: { label: "로그인하기", kind: "login" },
    showsEmailField: true,
    hasCountdown: false,
  },
  flow_state_expired: {
    title: "인증 절차가 만료됐어요",
    message: "조금 오래 걸렸어요. 처음부터 다시 시도해주세요.",
    primary: { label: "다시 시도하기", kind: "retry" },
    secondary: { label: "로그인하기", kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  flow_state_not_found: {
    title: "인증 요청을 찾을 수 없어요",
    message:
      "다른 기기나 브라우저에서 시작한 링크일 수 있어요. 지금 사용하는 브라우저에서 처음부터 다시 시도해주세요.",
    primary: { label: "다시 시도하기", kind: "retry" },
    secondary: { label: "도움말", kind: "help" },
    showsEmailField: false,
    hasCountdown: false,
  },
  bad_code_verifier: {
    title: "보안 검증에 실패했어요",
    message: "처음 인증을 시작한 브라우저에서 끝까지 진행해주세요.",
    primary: { label: "처음부터 다시", kind: "retry" },
    showsEmailField: false,
    hasCountdown: false,
  },
  user_not_found: {
    title: "이 계정은 더 이상 존재하지 않아요",
    message:
      "오래 비활성화된 계정은 자동으로 정리됐어요. 다시 가입하시면 바로 사용할 수 있어요.",
    primary: { label: "다시 가입하기", kind: "signup" },
    secondary: { label: "로그인하기", kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  over_email_send_rate_limit: {
    title: "메일을 너무 많이 보냈어요",
    message: "잠시 후 다시 시도해주세요. 남은 시간이 끝나면 자동으로 다시 보낼 수 있어요.",
    primary: { label: "잠시 후 다시 시도", kind: "resend" },
    showsEmailField: true,
    hasCountdown: true,
  },
  over_request_rate_limit: {
    title: "요청이 너무 많아요",
    message: "잠시 후 다시 시도해주세요.",
    primary: { label: "잠시 후 다시 시도", kind: "retry" },
    showsEmailField: false,
    hasCountdown: true,
  },
  email_not_confirmed: {
    title: "이메일 인증이 아직 완료되지 않았어요",
    message: "받은편지함에서 인증 메일을 확인해주세요. 메일이 보이지 않으면 다시 받을 수 있어요.",
    primary: { label: "인증 메일 다시 받기", kind: "resend" },
    secondary: { label: "로그인하기", kind: "login" },
    showsEmailField: true,
    hasCountdown: false,
  },
  signup_disabled: {
    title: "현재 신규 가입이 일시 중단됐어요",
    message: "잠시 후 다시 시도해주세요. 불편을 드려 죄송합니다.",
    primary: { label: "홈으로", kind: "home" },
    showsEmailField: false,
    hasCountdown: false,
  },
  access_denied: {
    title: "인증이 거부됐어요",
    message: "다시 시도하시려면 가입 또는 로그인 페이지로 이동해주세요.",
    primary: { label: "다시 가입하기", kind: "signup" },
    secondary: { label: "로그인하기", kind: "login" },
    showsEmailField: false,
    hasCountdown: false,
  },
  unknown: {
    title: "처리 중 문제가 생겼어요",
    message: "잠시 후 다시 시도해주세요. 문제가 계속되면 지원 채널로 알려주세요.",
    primary: { label: "홈으로", kind: "home" },
    secondary: { label: "도움말", kind: "help" },
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
