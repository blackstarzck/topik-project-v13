import { describe, expect, it } from "vitest";

import { paywallHref, resolvePaywallReturnTo } from "@/lib/paywall/routes";

describe("paywall route helpers", () => {
  it.each(["/practice/next", "/practice/next?source=alternative#plans"])(
    "preserves an allowed paywall return target: %s",
    (returnTo) => {
      expect(resolvePaywallReturnTo(returnTo)).toBe(returnTo);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "/dashboard",
    "/practice/problems",
    "https://evil.example/practice/next",
    "//evil.example/practice/next",
    "/\\evil.example/practice/next",
    "/practice/next?returnTo=%2Fdashboard",
    ["/practice/next", "/dashboard"],
  ])("falls back for an unsafe paywall return target: %j", (returnTo) => {
    expect(resolvePaywallReturnTo(returnTo)).toBe("/dashboard");
  });

  it("adds one encoded return target to the paywall link", () => {
    const href = paywallHref({
      returnTo: "/practice/next?source=alternative#plans",
    });
    const url = new URL(href, "https://talkpik.test");

    expect(url.pathname).toBe("/paywall");
    expect(url.searchParams.getAll("returnTo")).toEqual([
      "/practice/next?source=alternative#plans",
    ]);
  });

  it("omits missing or unsafe targets from direct paywall links", () => {
    expect(paywallHref()).toBe("/paywall");
    expect(paywallHref({ returnTo: "https://evil.example" })).toBe("/paywall");
  });
});
