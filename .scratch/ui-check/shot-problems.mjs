// One-off visual check for /practice/problems after the tag/difficulty/number
// redesign. Reuses the authed storageState produced by the e2e `setup` project.
// Run AFTER `pnpm test:e2e` so the storageState is fresh.
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = ".scratch/ui-check";

const browser = await chromium.launch();
try {
  for (const [name, width] of [
    ["desktop", 1280],
    ["mobile", 360],
  ]) {
    const ctx = await browser.newContext({
      storageState: "tests/e2e/auth-state/student.json",
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/practice/problems`, { waitUntil: "networkidle" });
    // Wait for the client RPC to settle into either rows or the empty state.
    await page
      .waitForSelector('[role="listitem"], .ant-empty', { timeout: 12000 })
      .catch(() => {});
    await page.waitForTimeout(800);

    const listitems = await page.locator('[role="listitem"]').count();
    const tagCount = await page.locator(".problem-row__tag").count();
    const heading = await page.getByRole("heading").first().textContent();
    console.log(
      `[${name}] heading=${JSON.stringify(heading)} rows=${listitems} tags=${tagCount}`,
    );

    await page.screenshot({ path: `${OUT}/problems-${name}.png`, fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}
