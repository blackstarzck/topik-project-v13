import { chromium } from "@playwright/test";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3000/settings/language", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="language-ui-radio"]', { timeout: 20000 });
const info = await page.evaluate(() => {
  const seg = document.querySelector('[data-testid="language-ui-radio"]');
  const parent = seg?.parentElement;
  const cs = seg ? getComputedStyle(seg) : null;
  const pcs = parent ? getComputedStyle(parent) : null;
  return {
    segClass: seg?.className,
    parentClass: parent?.className,
    seg: cs ? { display: cs.display, justifySelf: cs.justifySelf, width: cs.width, maxWidth: cs.maxWidth, overflowX: cs.overflowX } : null,
    parent: pcs ? { display: pcs.display, gridTemplateColumns: pcs.gridTemplateColumns, justifyItems: pcs.justifyItems } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
