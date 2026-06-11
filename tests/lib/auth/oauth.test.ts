import { describe, expect, it } from "vitest";

import {
  buildClientAuthCallbackUrl,
  buildPostAuthPath,
} from "../../../src/lib/auth/oauth";

describe("Google OAuth URL helpers", () => {
  it("buildPostAuthPath keeps login and sign-up intents distinct", () => {
    expect(buildPostAuthPath("login")).toBe("/auth/post-auth?intent=login");
    expect(buildPostAuthPath("sign-up")).toBe(
      "/auth/post-auth?intent=sign-up",
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

  it("buildClientAuthCallbackUrl rejects absolute next URLs", () => {
    expect(() =>
      buildClientAuthCallbackUrl(
        "https://evil.example",
        "http://localhost:3000",
      ),
    ).toThrow(/relative/);
  });
});
