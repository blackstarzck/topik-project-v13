import { test, expect, type Page } from "@playwright/test";

// Tier 2 — per-screen validation for AUTHED (workspace) screens. Uses the
// storageState produced by the `setup` project (learner session). Runs in all
// three viewport projects for responsive coverage.
//
// Each screen asserts: it did NOT bounce to /login (auth works), the route
// rendered (a heading is visible = hydration), and ZERO uncaught page errors.
//
// Durable, existing audit submissions (not created by this suite):
//   short feedback ...051, long feedback ...053.
// R-01 compare is intentionally excluded here (depends on an ephemeral seeded
// report id); it is covered by the capture pass and the Tier-3 flow.
const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051";
const SUB_LONG = "a0d17000-0000-4000-8000-000000000053";

type Screen = { ia: string; name: string; route: string; pathRegex: RegExp };

const AUTHED_SCREENS: Screen[] = [
  { ia: "A-03", name: "learning-goal-setup", route: "/onboarding/learning-goal", pathRegex: /\/onboarding\/learning-goal/ },
  { ia: "B-01", name: "home-dashboard", route: "/dashboard", pathRegex: /\/dashboard/ },
  { ia: "C-01", name: "problem-type-recommendations", route: "/practice/recommendations", pathRegex: /\/practice\/recommendations/ },
  { ia: "C-02", name: "problem-list", route: "/practice/problems", pathRegex: /\/practice\/problems/ },
  { ia: "D-01", name: "short-answer-writing-51", route: "/writing/short-answer-writing-51", pathRegex: /short-answer-writing-51/ },
  { ia: "D-02", name: "answer-writing-52", route: "/writing/answer-writing-52", pathRegex: /answer-writing-52/ },
  { ia: "D-03", name: "long-form-writing-53", route: "/writing/long-form-writing-53", pathRegex: /long-form-writing-53/ },
  { ia: "D-04", name: "essay-writing-54", route: "/writing/essay-writing-54", pathRegex: /essay-writing-54/ },
  { ia: "E-01", name: "short-answer-feedback", route: `/writing/feedback/short/${SUB_SHORT}`, pathRegex: /\/writing\/feedback\/short\// },
  { ia: "E-02", name: "long-form-feedback", route: `/writing/feedback/long/${SUB_LONG}`, pathRegex: /\/writing\/feedback\/long\// },
  { ia: "R-02", name: "next-problem-recommendation", route: "/practice/next", pathRegex: /\/practice\/next/ },
  { ia: "F-01", name: "my-library", route: "/library", pathRegex: /\/library/ },
  { ia: "G-01", name: "language-settings", route: "/settings/language", pathRegex: /\/settings\/language/ },
  { ia: "X-02", name: "growth-dashboard", route: "/growth", pathRegex: /\/growth/ },
  { ia: "X-03", name: "paywall", route: "/paywall", pathRegex: /\/paywall/ },
  { ia: "X-04", name: "subscription-management", route: "/subscription", pathRegex: /\/subscription/ },
  { ia: "X-05", name: "profile-editing", route: "/profile", pathRegex: /\/profile/ },
  { ia: "X-07", name: "weakness-based-recommendations", route: "/practice/weakness", pathRegex: /\/practice\/weakness/ },
  { ia: "X-09", name: "notification-settings", route: "/settings/notifications", pathRegex: /\/settings\/notifications/ },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

for (const s of AUTHED_SCREENS) {
  test(`${s.ia} ${s.name} renders authed without page errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(s.route, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // auth held (not bounced to /login) and we are on the intended route.
    await expect(page, "bounced to /login — storageState stale?").not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(s.pathRegex);

    // hydration: a heading rendered (workspace shell + page content).
    await expect(page.getByRole("heading").first()).toBeVisible();

    expect(errors, `uncaught page errors on ${s.route}:\n${errors.join("\n")}`).toEqual([]);
  });
}
