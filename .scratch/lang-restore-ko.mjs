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

if (before !== "언어 설정") {
  // Click the first radio input (ko) inside the UI-language Segmented directly.
  const koInput = page.locator('[data-testid="language-ui-radio"] input[type="radio"]').first();
  await koInput.click({ force: true });
  const save = page.getByTestId("language-save");
  await save.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-testid="language-save"]');
      return b && !b.disabled;
    },
    null,
    { timeout: 10000 },
  );
  await save.click();
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "언어 설정", null, { timeout: 25000 });
  console.log("RESTORED_TO_KO");
} else {
  console.log("ALREADY_KO");
}

await page.waitForTimeout(800);
console.log("AFTER_H1 " + JSON.stringify(await page.evaluate(() => document.querySelector("h1")?.textContent)));
await browser.close();
