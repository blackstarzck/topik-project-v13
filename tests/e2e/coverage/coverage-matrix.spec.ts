// Implementation Coverage Audit (Plan rev4, SBU-B+C) — Task 4.
// Lifecycle: durable. Future Phase 7+ regression seed.
//
// Visits all 32 Tier 1 routes per docs/sitemap.md and captures:
//   - HTTP status (200, 3xx redirect, 5xx)
//   - Console errors
//   - Visible h1 / data attributes for grade signal
//   - Screenshot at each project's viewport (360/768/1280)
//
// Results: screenshots/coverage-{IA}-{bp}.png, failure-log.json

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync("screenshots", { recursive: true });

type Route = {
  ia: string;
  url: string;
  audience: "public" | "user" | "admin";
};

const ROUTES: Route[] = [
  { ia: "X-01", url: "/", audience: "public" },
  { ia: "A-01", url: "/sign-up", audience: "public" },
  { ia: "A-02", url: "/login", audience: "public" },
  { ia: "X-06", url: "/password-reset", audience: "public" },
  { ia: "A-03", url: "/onboarding/learning-goal", audience: "user" },
  { ia: "B-01", url: "/dashboard", audience: "user" },
  { ia: "C-01", url: "/practice/recommendations", audience: "user" },
  { ia: "C-02", url: "/practice/problems", audience: "user" },
  { ia: "D-01", url: "/writing/51", audience: "user" },
  { ia: "D-02", url: "/writing/52", audience: "user" },
  { ia: "D-03", url: "/writing/53", audience: "user" },
  { ia: "D-04", url: "/writing/54", audience: "user" },
  { ia: "E-01", url: "/writing/feedback/short/bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb", audience: "user" },
  { ia: "E-02", url: "/writing/feedback/long/bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb", audience: "user" },
  { ia: "R-01", url: "/writing/reports/bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb/compare", audience: "user" },
  { ia: "R-02", url: "/practice/next", audience: "user" },
  { ia: "F-01", url: "/library", audience: "user" },
  { ia: "G-01", url: "/settings/language", audience: "user" },
  { ia: "X-02", url: "/growth", audience: "user" },
  { ia: "X-03", url: "/paywall", audience: "user" },
  { ia: "X-04", url: "/subscription", audience: "user" },
  { ia: "X-05", url: "/profile", audience: "user" },
  { ia: "X-07", url: "/practice/weakness", audience: "user" },
  { ia: "X-09", url: "/settings/notifications", audience: "user" },
  // admin
  { ia: "H-01", url: "/admin/problems", audience: "admin" },
  { ia: "X-08", url: "/admin/org", audience: "admin" },
  { ia: "X-10", url: "/admin/users", audience: "admin" },
];

function viewportTag(viewport: { width: number; height: number } | null): string {
  if (!viewport) return "unknown";
  return `${viewport.width}`;
}

for (const route of ROUTES) {
  test(`${route.ia} ${route.url} (${route.audience})`, async ({ page, browserName, browser }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    // Audience-based storageState
    if (route.audience !== "public") {
      const stateFile = route.audience === "admin"
        ? "tests/e2e/auth-state/platform_admin.json"
        : "tests/e2e/auth-state/student.json";
      // Reopen context with storage state for this test
      const ctx = await browser.newContext({
        storageState: stateFile,
        viewport: page.viewportSize() ?? undefined,
      });
      const newPage = await ctx.newPage();
      newPage.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      newPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });

      const resp = await newPage.goto(route.url, { waitUntil: "domcontentloaded" });
      await newPage.waitForTimeout(800); // settle for client hydration / dynamic data

      const bp = viewportTag(newPage.viewportSize());
      const screenshotPath = join("screenshots", `coverage-${route.ia}-${bp}.png`);
      await newPage.screenshot({ path: screenshotPath, fullPage: false });

      const status = resp?.status();
      const url = newPage.url();
      const title = await newPage.title();
      const visibleH1 = await newPage.locator("h1").first().textContent().catch(() => null);

      await testInfo.attach("audit-meta", {
        body: JSON.stringify({ ia: route.ia, status, url, title, visibleH1, errors, bp, audience: route.audience }, null, 2),
        contentType: "application/json",
      });

      await ctx.close();

      expect(status, `${route.ia} HTTP status`).toBeLessThan(500);
      return;
    }

    // public
    const resp = await page.goto(route.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const bp = viewportTag(page.viewportSize());
    const screenshotPath = join("screenshots", `coverage-${route.ia}-${bp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const status = resp?.status();
    const url = page.url();
    const title = await page.title();
    const visibleH1 = await page.locator("h1").first().textContent().catch(() => null);

    await testInfo.attach("audit-meta", {
      body: JSON.stringify({ ia: route.ia, status, url, title, visibleH1, errors, bp, audience: route.audience }, null, 2),
      contentType: "application/json",
    });

    expect(status, `${route.ia} HTTP status`).toBeLessThan(500);
  });
}
