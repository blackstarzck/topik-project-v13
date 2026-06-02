import { describe, expect, it } from "vitest";

import {
  REASON_CONTENT,
  isValidReason,
  mapSupabaseErrorCode,
  parseAuthFragment,
  sanitizeNext,
  sanitizeRetryAfterSeconds,
  type AuthErrorReason,
} from "../../../src/lib/auth/error-mapping";

describe("mapSupabaseErrorCode", () => {
  it("returns canonical reason for each Supabase error code", () => {
    const canonical: AuthErrorReason[] = [
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
    ];
    for (const code of canonical) {
      expect(mapSupabaseErrorCode(code)).toBe(code);
    }
  });

  it("falls back to 'unknown' for unsupported code", () => {
    expect(mapSupabaseErrorCode("some_new_supabase_code")).toBe("unknown");
    expect(mapSupabaseErrorCode("")).toBe("unknown");
    expect(mapSupabaseErrorCode(null)).toBe("unknown");
    expect(mapSupabaseErrorCode(undefined)).toBe("unknown");
  });
});

describe("isValidReason", () => {
  it("accepts canonical reasons", () => {
    expect(isValidReason("otp_expired")).toBe(true);
    expect(isValidReason("user_not_found")).toBe(true);
  });
  it("rejects non-canonical or empty", () => {
    expect(isValidReason("invented_reason")).toBe(false);
    expect(isValidReason("")).toBe(false);
    expect(isValidReason(null)).toBe(false);
  });
});

describe("REASON_CONTENT", () => {
  it("covers every AuthErrorReason exactly once", () => {
    const keys: AuthErrorReason[] = [
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
    ];
    expect(Object.keys(REASON_CONTENT).sort()).toEqual([...keys].sort());
  });

  // i18n: title / message / CTA labels moved to the `auth.error.<reason>.*`
  // catalog (resolved by the component). REASON_CONTENT now holds only the
  // locale-free shape, so the contract test asserts that shape instead of copy.
  it("each entry has a routing kind on its primary CTA and boolean flags", () => {
    for (const key of Object.keys(REASON_CONTENT) as AuthErrorReason[]) {
      const entry = REASON_CONTENT[key];
      expect(entry.primary.kind.length).toBeGreaterThan(0);
      if (entry.secondary) {
        expect(entry.secondary.kind.length).toBeGreaterThan(0);
      }
      expect(typeof entry.showsEmailField).toBe("boolean");
      expect(typeof entry.hasCountdown).toBe("boolean");
    }
  });

  it("user_not_found primary CTA points to signup (cleanup-deleted recovery path)", () => {
    expect(REASON_CONTENT.user_not_found.primary.kind).toBe("signup");
  });

  it("rate-limit reasons have countdown enabled", () => {
    expect(REASON_CONTENT.over_email_send_rate_limit.hasCountdown).toBe(true);
    expect(REASON_CONTENT.over_request_rate_limit.hasCountdown).toBe(true);
  });

  it("resend-relevant reasons show editable email field", () => {
    expect(REASON_CONTENT.otp_expired.showsEmailField).toBe(true);
    expect(REASON_CONTENT.email_not_confirmed.showsEmailField).toBe(true);
    expect(REASON_CONTENT.over_email_send_rate_limit.showsEmailField).toBe(true);
  });
});

describe("sanitizeNext", () => {
  it("accepts a relative path", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/practice/problems")).toBe("/practice/problems");
  });

  it("falls back when not starting with /", () => {
    expect(sanitizeNext("dashboard")).toBe("/dashboard");
  });

  it("rejects protocol-relative URL", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
  });

  it("rejects absolute URL", () => {
    expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNext("http://evil.com/dashboard")).toBe("/dashboard");
  });

  it("rejects javascript scheme", () => {
    expect(sanitizeNext("javascript:alert(1)")).toBe("/dashboard");
  });

  it("uses custom fallback", () => {
    expect(sanitizeNext(null, "/home")).toBe("/home");
    expect(sanitizeNext("//evil", "/home")).toBe("/home");
  });
});

describe("parseAuthFragment (Phase 8.5)", () => {
  it("parses error_code style fragment (Supabase implicit flow expired)", () => {
    const r = parseAuthFragment(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(r.errorCode).toBe("otp_expired");
    expect(r.errorDescription).toBe("Email link is invalid or has expired");
    expect(r.accessToken).toBeNull();
  });

  it("parses access_token style fragment (Supabase implicit flow success)", () => {
    const r = parseAuthFragment(
      "#access_token=abc.def.ghi&refresh_token=xyz123&token_type=bearer&type=signup",
    );
    expect(r.accessToken).toBe("abc.def.ghi");
    expect(r.refreshToken).toBe("xyz123");
    expect(r.tokenType).toBe("bearer");
    expect(r.type).toBe("signup");
    expect(r.errorCode).toBeNull();
  });

  it("handles leading # absent", () => {
    const r = parseAuthFragment("error_code=signup_disabled");
    expect(r.errorCode).toBe("signup_disabled");
  });

  it("handles empty / null / '#'", () => {
    expect(parseAuthFragment("").errorCode).toBeNull();
    expect(parseAuthFragment("#").errorCode).toBeNull();
    expect(parseAuthFragment(null).errorCode).toBeNull();
    expect(parseAuthFragment(undefined).errorCode).toBeNull();
  });
});

describe("sanitizeRetryAfterSeconds", () => {
  it("accepts positive integer within range", () => {
    expect(sanitizeRetryAfterSeconds("60")).toBe(60);
    expect(sanitizeRetryAfterSeconds("3600")).toBe(3600);
    expect(sanitizeRetryAfterSeconds("1")).toBe(1);
    expect(sanitizeRetryAfterSeconds("86400")).toBe(86400);
  });

  it("rejects out of range", () => {
    expect(sanitizeRetryAfterSeconds("0")).toBeNull();
    expect(sanitizeRetryAfterSeconds("-1")).toBeNull();
    expect(sanitizeRetryAfterSeconds("86401")).toBeNull();
  });

  it("rejects non-integer", () => {
    expect(sanitizeRetryAfterSeconds("60.5")).toBeNull();
    expect(sanitizeRetryAfterSeconds("abc")).toBeNull();
    expect(sanitizeRetryAfterSeconds("")).toBeNull();
    expect(sanitizeRetryAfterSeconds(null)).toBeNull();
    expect(sanitizeRetryAfterSeconds(undefined)).toBeNull();
  });
});
