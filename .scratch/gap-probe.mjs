import { chromium } from "@playwright/test";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3000/settings/language", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="language-help-card"]', { timeout: 20000 });
const info = await page.evaluate(() => {
  const rows = document.querySelector(".settings-field-rows");
  const help = document.querySelector('[data-testid="language-help-card"]');
  const cs = help ? getComputedStyle(help) : null;
  const gap = rows && help
    ? Math.round(help.getBoundingClientRect().top - rows.getBoundingClientRect().bottom)
    : null;
  return {
    helpMarginTop: cs?.marginTop,
    helpClass: help?.className,
    visualGapRowsToHelp: gap,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
