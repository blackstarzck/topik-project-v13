import { describe, expect, it } from "vitest";

import {
  buildClientAuthCallbackUrl,
  buildOAuthNextPath,
  buildPostAuthPath,
  getGoogleOAuthBrowserSupport,
  GoogleOAuthUnsupportedBrowserError,
} from "../../../src/lib/auth/oauth";

describe("Google OAuth URL helpers", () => {
  it("buildPostAuthPath keeps auth and linking intents distinct", () => {
    expect(buildPostAuthPath("login")).toBe("/auth/post-auth?intent=login");
    expect(buildPostAuthPath("sign-up")).toBe("/auth/post-auth?intent=sign-up");
    expect(buildPostAuthPath("link-google")).toBe(
      "/auth/post-auth?intent=link-google",
    );
  });

  it("buildOAuthNextPath sends default sign-up OAuth to post-auth without invite confirmation", () => {
    expect(buildOAuthNextPath("sign-up")).toBe(
      "/auth/post-auth?intent=sign-up",
    );
  });

  it("buildOAuthNextPath preserves an explicit internal next target", () => {
    expect(buildOAuthNextPath("sign-up", "/settings/account")).toBe(
      "/settings/account",
    );
  });

  it("buildClientAuthCallbackUrl uses the active browser origin", () => {
    expect(
      buildClientAuthCallbackUrl(
        "/auth/post-auth?intent=login",
        "http://localhost:3000",
      ),
    ).toBe(
      "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
    );
  });

  it("buildClientAuthCallbackUrl normalizes local 0.0.0.0 origins to localhost", () => {
    expect(
      buildClientAuthCallbackUrl(
        "/auth/post-auth?intent=login",
        "http://0.0.0.0:3000",
      ),
    ).toBe(
      "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
    );
  });

  it("buildClientAuthCallbackUrl rejects absolute next URLs", () => {
    expect(() =>
      buildClientAuthCallbackUrl(
        "https://evil.example",
        "http://localhost:3000",
      ),
    ).toThrow(/relative/);
  });

  it("allows normal mobile browsers to start Google OAuth", () => {
    expect(
      getGoogleOAuthBrowserSupport(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ supported: true });
  });

  it("blocks KakaoTalk embedded browsers before Google OAuth starts", () => {
    expect(
      getGoogleOAuthBrowserSupport(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.7.0",
      ),
    ).toEqual({
      supported: false,
      browser: "kakaoTalk",
      reason: "embedded_user_agent",
    });
  });

  it("blocks unsupported embedded browsers before Google OAuth starts", () => {
    expect(
      getGoogleOAuthBrowserSupport(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.0.0",
      ),
    ).toEqual({
      supported: false,
      browser: "line",
      reason: "embedded_user_agent",
    });
    const error = new GoogleOAuthUnsupportedBrowserError("line");
    expect(error.name).toBe("GoogleOAuthUnsupportedBrowserError");
    expect(error.browser).toBe("line");
  });
});
