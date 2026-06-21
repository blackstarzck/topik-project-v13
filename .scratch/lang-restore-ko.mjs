import { chromium } from "@playwright/test";

const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/language";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="language-ui-radio"]', { timeout: 20000 });
const before = await page.evaluate(() => document.querySelector("h1")?.textContent);
console.log("BEFORE_H1 " + JSON.stringify(before));

const saveEnabled = () => {
  const b = document.querySelector('[data-testid="language-save"]');
  return !!b && !b.disabled;
};

if (before !== "언어 설정") {
  const koPill = page
    .locator('[data-testid="language-ui-radio"] .ant-segmented-item')
    .filter({ hasText: "한국어" });
  let enabled = false;
  for (let i = 0; i < 6 && !enabled; i++) {
    await koPill.click({ timeout: 5000 });
    try {
      await page.waitForFunction(saveEnabled, null, { timeout: 2500 });
      enabled = true;
    } catch {
      /* retry */
    }
  }
  if (!enabled) throw new Error("could not enable save after selecting 한국어");
  await page.getByTestId("language-save").click();
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "언어 설정", null, { timeout: 25000 });
  console.log("RESTORED_TO_KO");
} else {
  console.log("ALREADY_KO");
}

await page.waitForTimeout(800);
console.log("AFTER_H1 " + JSON.stringify(await page.evaluate(() => document.querySelector("h1")?.textContent)));
await browser.close();
