import { chromium } from "@playwright/test";

const OUT = "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/9f835a76-4c31-48f5-a189-93a4885dce3d/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/language";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="language-ui-radio"]', { timeout: 20000 });
const startH1 = await page.evaluate(() => document.querySelector("h1")?.textContent);
console.log("START_H1 " + JSON.stringify(startH1));

if (startH1 !== "언어 설정") {
  await page
    .locator('[data-testid="language-ui-radio"] .ant-segmented-item-label', { hasText: /^한국어$/ })
    .click();
  await page.getByTestId("language-save").click();
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "언어 설정", null, { timeout: 25000 });
  await page.waitForTimeout(1000);
  console.log("RESTORED_TO_KO");
} else {
  console.log("ALREADY_KO");
}

await page.waitForSelector('[data-testid="language-learning-radio"]', { timeout: 20000 });
const pageOverflow = () => {
  const de = document.documentElement;
  return de.scrollWidth - de.clientWidth;
};

await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/lang-desktop.png`, fullPage: true });
console.log("DESKTOP_OVERFLOW " + (await page.evaluate(pageOverflow)));

await page.setViewportSize({ width: 360, height: 740 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/lang-mobile-ko.png`, fullPage: true });
console.log("MOBILE_KO_OVERFLOW " + (await page.evaluate(pageOverflow)));

await browser.close();
