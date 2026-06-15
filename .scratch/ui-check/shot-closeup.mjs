// Close-up comparison: first problem-list row vs. recommendation reason tags.
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = ".scratch/ui-check";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    storageState: "tests/e2e/auth-state/student.json",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();

  // 1) Problem list first row close-up.
  await page.goto(`${BASE}/practice/problems`, { waitUntil: "networkidle" });
  await page.waitForSelector('[role="listitem"]', { timeout: 12000 });
  await page.waitForTimeout(500);
  await page
    .locator('[role="listitem"]')
    .first()
    .screenshot({ path: `${OUT}/row-closeup.png` });

  // 2) Recommendation reason tags for visual parity.
  await page.goto(`${BASE}/practice/recommendations`, { waitUntil: "networkidle" });
  await page
    .waitForSelector(".recommendation-reason-card__tag", { timeout: 12000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  const reason = page.locator(".recommendation-reason-card").first();
  if (await reason.count()) {
    await reason.screenshot({ path: `${OUT}/reason-tags.png` });
  }
  console.log("captured row-closeup.png + reason-tags.png");
  await ctx.close();
} finally {
  await browser.close();
}
