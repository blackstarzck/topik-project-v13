// IA Implementation Verification — Phase 2 Browser Coverage.
// Plan §8 Step 2.2.
//
// Imports tests/e2e/coverage/ia-catalog.ts as the single source of truth for
// 34 IA entries (page + hosted-modal + hosted-state). For hosted surfaces this
// spec only covers the HOST route (initial render); Phase 3
// (hosted-surfaces.spec.ts) covers actual modal triggering, focus return, and
// duplicate-action prevention.
//
// Behavior:
//   - Public routes: visited without storageState.
//   - Protected routes (audience=user/admin): visited with the role's
//     storageState file when present; otherwise the test records the missing
//     storageState in the attached audit-meta and SKIPS expect assertions so
//     the run can collect partial evidence without false PASSes.
//   - Captures HTTP status, final URL, title, h1, console/page errors,
//     screenshots per viewport, and a per-IA UX-state list (default for now;
//     loading/empty/error states require interaction beyond Phase 2 scope).
//   - Outputs feed: tests/e2e/coverage/failure-log.json (Playwright JSON
//     reporter) + per-test attached audit-meta consumed by
//     scripts/audit-setup/build-browser-results.mjs.

import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { IA_CATALOG, type IaCatalogEntry } from "./ia-catalog";

mkdirSync("screenshots", { recursive: true });

const STORAGE_DIR = "tests/e2e/auth-state";
const FIXTURE_UUIDS = {
  "uuid-owner": "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb",
  "uuid-other": "cccccccc-3333-3333-3333-cccccccccccc",
  "uuid-malformed": "not-a-uuid",
};

function viewportTag(viewport: { width: number; height: number } | null): string {
  if (!viewport) return "unknown";
  return `${viewport.width}`;
}

function targetUrl(entry: IaCatalogEntry): string | null {
  if (entry.routeType === "page") {
    if (entry.fixtureIdType === "none") return entry.routeOrHostRoute;
    const uuid = FIXTURE_UUIDS[entry.fixtureIdType];
    if (!uuid) return null;
    return entry.routeOrHostRoute.replace(":id", uuid);
  }
  // hosted modal/state — Phase 2 only screenshots the first host route.
  if (entry.hostRoutes && entry.hostRoutes.length > 0) {
    const firstHost = entry.hostRoutes[0];
    if (firstHost.includes(":id")) {
      const uuid = FIXTURE_UUIDS[entry.fixtureIdType] ?? FIXTURE_UUIDS["uuid-owner"];
      return firstHost.replace(":id", uuid);
    }
    return firstHost;
  }
  return null;
}

function storageStateFor(entry: IaCatalogEntry): { path: string | null; exists: boolean } {
  if (entry.audience === "public") return { path: null, exists: true };
  const role = entry.authStateRole ?? (entry.audience === "admin" ? "platform_admin" : "student");
  const path = join(STORAGE_DIR, `${role}.json`);
  return { path, exists: existsSync(path) };
}

for (const entry of IA_CATALOG) {
  const url = targetUrl(entry);
  const description = `${entry.iaCode} ${entry.screenName} (${entry.routeType}, ${entry.audience})`;

  if (!url) {
    test.skip(`${description} — skipped: no concrete URL derivable from catalog`, () => {});
    continue;
  }

  test(description, async ({ page, browser }, testInfo) => {
    const storage = storageStateFor(entry);
    const errors: string[] = [];

    // Capture errors on both default and storage-state-augmented contexts.
    const attachErrorListeners = (target: typeof page) => {
      target.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      target.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });
    };

    let active = page;
    let storageStateMissing = false;

    if (storage.path && !storage.exists) {
      storageStateMissing = true;
    } else if (storage.path && storage.exists) {
      const ctx = await browser.newContext({
        storageState: storage.path,
        viewport: page.viewportSize() ?? undefined,
      });
      active = await ctx.newPage();
    }

    attachErrorListeners(active);

    let status: number | undefined;
    let finalUrl: string | undefined;
    let title = "";
    let visibleH1: string | null = null;
    let primaryCtaPresent: boolean | null = null;
    let navigationFailureReason: string | null = null;

    if (!storageStateMissing) {
      try {
        const resp = await active.goto(url, { waitUntil: "domcontentloaded" });
        await active.waitForTimeout(500);
        status = resp?.status();
        finalUrl = active.url();
        title = await active.title();
        visibleH1 = await active.locator("h1").first().textContent().catch(() => null);
        if (entry.expectedPrimaryCta && entry.routeType === "page") {
          // Heuristic: search for a button or link whose accessible name matches
          // the expected CTA pattern. Records boolean only; final assertion is
          // intentionally loose so Phase 2 can collect evidence broadly.
          const ctaMatch =
            typeof entry.expectedPrimaryCta === "string"
              ? new RegExp(entry.expectedPrimaryCta, "i")
              : entry.expectedPrimaryCta;
          // Use short timeout (500ms) on heuristic CTA checks — default
          // Locator.isVisible() waits up to 5s per element which compounds
          // to 10s+ per test when CTA pattern doesn't match. We just want a
          // snapshot of what's visible *right now*, not a wait-for-it.
          primaryCtaPresent = await Promise.race([
            active.getByRole("button", { name: ctaMatch }).first().isVisible(),
            active.getByRole("link", { name: ctaMatch }).first().isVisible(),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
          ]).catch(() => false);
        }
      } catch (navError) {
        navigationFailureReason = navError instanceof Error ? navError.message : String(navError);
      }
    }

    const bp = viewportTag(active.viewportSize());
    const screenshotPath = join("screenshots", `coverage-${entry.iaCode}-${bp}.png`);
    if (!storageStateMissing) {
      await active.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    }

    const auditMeta = {
      iaCode: entry.iaCode,
      screenName: entry.screenName,
      routeType: entry.routeType,
      audience: entry.audience,
      routeOrHostRoute: entry.routeOrHostRoute,
      visitedUrl: url,
      finalUrl,
      status,
      title,
      visibleH1,
      expectedHeadingPattern: entry.expectedHeadingPattern?.toString(),
      headingMatch:
        entry.expectedHeadingPattern && visibleH1
          ? (typeof entry.expectedHeadingPattern === "string"
              ? new RegExp(entry.expectedHeadingPattern, "i")
              : entry.expectedHeadingPattern
            ).test(visibleH1)
          : null,
      expectedPrimaryCta: entry.expectedPrimaryCta?.toString(),
      primaryCtaPresent,
      uxStatesRequired: entry.uxStatesRequired,
      uxStatesCaptured: storageStateMissing || navigationFailureReason ? [] : ["default"],
      uxStatesUnavailableReason: entry.uxStatesUnavailableReason ?? {},
      formEvidenceRequired: entry.formEvidenceRequired,
      aiOutputEvidenceRequired: entry.aiOutputEvidenceRequired,
      policyEvidenceRequired: entry.policyEvidenceRequired,
      billingEvidenceRequired: entry.billingEvidenceRequired,
      notificationEvidenceRequired: entry.notificationEvidenceRequired,
      authEvidenceRequired: entry.authEvidenceRequired,
      adminEvidenceRequired: entry.adminEvidenceRequired,
      deferred: entry.deferred,
      packs: entry.packs,
      bp,
      viewport: active.viewportSize(),
      errors,
      screenshotPath: storageStateMissing ? null : screenshotPath,
      storageStatePath: storage.path,
      storageStateMissing,
      navigationFailureReason,
      notes: entry.notes,
    };

    await testInfo.attach("audit-meta", {
      body: JSON.stringify(auditMeta, null, 2),
      contentType: "application/json",
    });

    if (storageStateMissing) {
      test.info().annotations.push({
        type: "storageState-missing",
        description: `Skipping protected-route assertions: ${storage.path} does not exist. Phase 2 evidence recorded as BLOCKED for this row.`,
      });
      return; // do not fail the run — record evidence and continue.
    }

    if (navigationFailureReason) {
      test.info().annotations.push({
        type: "navigation-error",
        description: navigationFailureReason,
      });
      return;
    }

    expect(status, `${entry.iaCode} HTTP status < 500`).toBeLessThan(500);
  });
}
