import { describe, expect, it } from "vitest";

import {
  POST_AUTH_LOGIN_PATH,
  sanitizeAuthCompletionNext,
} from "../../../src/lib/auth/completion-routes";

describe("sanitizeAuthCompletionNext", () => {
  it("keeps safe in-app destinations", () => {
    expect(sanitizeAuthCompletionNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeAuthCompletionNext("/practice/problems?level=1")).toBe(
      "/practice/problems?level=1",
    );
  });

  it("falls back for auth completion loops and unsafe destinations", () => {
    const fallback = "/auth/post-auth?intent=sign-up";

    expect(sanitizeAuthCompletionNext("/auth/consent", fallback)).toBe(
      fallback,
    );
    expect(sanitizeAuthCompletionNext("/auth/callback?code=123", fallback)).toBe(
      fallback,
    );
    expect(sanitizeAuthCompletionNext("/auth/callback/otp", fallback)).toBe(
      fallback,
    );
    expect(sanitizeAuthCompletionNext("/login", fallback)).toBe(fallback);
    expect(sanitizeAuthCompletionNext("/sign-up", fallback)).toBe(fallback);
    expect(sanitizeAuthCompletionNext("//evil.example", fallback)).toBe(
      fallback,
    );
  });

  it("uses the login post-auth route as the default fallback", () => {
    expect(sanitizeAuthCompletionNext("/auth/account-inactive")).toBe(
      POST_AUTH_LOGIN_PATH,
    );
  });
});
