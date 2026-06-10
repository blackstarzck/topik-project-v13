import { test, expect, type Page } from "@playwright/test";

// Tier 2 — per-screen validation for PUBLIC (unauthenticated) screens.
// Runs in all three viewport projects (360/768/1280) for responsive coverage.
// storageState is cleared so authed-redirect middleware does not bounce these.
//
// Each screen asserts: intended URL (no unexpected redirect), hydration (a heading
// renders), and ZERO uncaught page errors. A page-level hydration error therefore
// fails the screen — this is intentional (it surfaces real bugs, e.g. X-16).
test.use({ storageState: { cookies: [], origins: [] } });

type Screen = {
  ia: string;
  name: string;
  route: string;
  urlRegex?: RegExp; // expected final path; omit for lenient (transient) screens
  lenientHeading?: boolean; // some fallback pages have no heading
};

const PUBLIC_SCREENS: Screen[] = [
  { ia: "X-01", name: "product-landing", route: "/", urlRegex: /\/$/ },
  { ia: "X-13", name: "terms", route: "/terms", urlRegex: /\/terms/ },
  { ia: "X-14", name: "privacy", route: "/privacy", urlRegex: /\/privacy/ },
  { ia: "A-01", name: "sign-up", route: "/sign-up", urlRegex: /\/sign-up/ },
  { ia: "A-02", name: "login", route: "/login", urlRegex: /\/login/ },
  {
    ia: "A-02",
    name: "login-session-expired",
    route: "/login?reason=session_expired",
    urlRegex: /\/login/,
  },
  {
    ia: "X-06",
    name: "password-reset",
    route: "/password-reset",
    urlRegex: /\/password-reset/,
  },
  {
    ia: "X-16",
    name: "password-reset-confirm",
    route: "/password-reset/confirm",
    urlRegex: /\/password-reset\/confirm/,
  },
  {
    ia: "X-11",
    name: "auth-error-otp",
    route: "/auth/error?reason=otp_expired",
    urlRegex: /\/auth\/error/,
  },
  {
    ia: "X-11",
    name: "auth-error-ratelimit",
    route: "/auth/error?reason=over_request_rate_limit",
    urlRegex: /\/auth\/error/,
  },
  {
    ia: "X-12",
    name: "auth-verify-email",
    route: "/auth/verify-email",
    urlRegex: /\/auth\/verify-email/,
  },
  // X-17 is a transient fragment-handling fallback — it may redirect; assert no crash only.
  {
    ia: "X-17",
    name: "auth-callback-fragment",
    route: "/auth/callback-fragment",
    lenientHeading: true,
  },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

for (const s of PUBLIC_SCREENS) {
  test(`${s.ia} ${s.name} renders without page errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(s.route, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    if (s.urlRegex) await expect(page).toHaveURL(s.urlRegex);

    if (!s.lenientHeading) {
      await expect(page.getByRole("heading").first()).toBeVisible();
    }

    if (s.name === "product-landing") {
      const heroVideo = page.locator("video.landing-hero-video");
      await expect(heroVideo).toBeVisible();
      await expect(heroVideo.locator("source")).toHaveAttribute(
        "src",
        "/assets/landing-hero-video.mp4",
      );
      await expect
        .poll(() =>
          heroVideo.evaluate((node) => (node as HTMLVideoElement).readyState),
        )
        .toBeGreaterThanOrEqual(2);
      await expect
        .poll(() =>
          heroVideo.evaluate((node) => (node as HTMLVideoElement).videoWidth),
        )
        .toBeGreaterThan(0);
      await expect(heroVideo).toHaveJSProperty("muted", true);
      await expect(heroVideo).toHaveJSProperty("loop", true);
      await expect(heroVideo).toHaveJSProperty("playsInline", true);
    }

    expect(
      errors,
      `uncaught page errors on ${s.route}:\n${errors.join("\n")}`,
    ).toEqual([]);
  });
}
