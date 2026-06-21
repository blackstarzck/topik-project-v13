import { chromium } from "@playwright/test";

const OUT = "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/9f835a76-4c31-48f5-a189-93a4885dce3d/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/language";

const HEADING = { ko: "언어 설정", en: "Language settings", vi: "Cài đặt ngôn ngữ" };

function measure() {
  const de = document.documentElement;
  const seg = document.querySelector('[data-testid="language-learning-radio"]');
  const group = seg ? seg.querySelector(".ant-segmented-group") : null;
  return {
    h1: document.querySelector("h1")?.textContent ?? null,
    pageOverflow: de.scrollWidth - de.clientWidth,
    segClientW: seg ? seg.clientWidth : null,
    groupContentW: group ? group.scrollWidth : null,
  };
}

async function switchTo(page, segmentLabel, locale) {
  await page
    .locator('[data-testid="language-ui-radio"] .ant-segmented-item-label', {
      hasText: new RegExp(`^${segmentLabel}$`),
    })
    .click();
  const save = page.getByTestId("language-save");
  await save.waitFor({ state: "visible" });
  await save.click();
  await page.waitForFunction(
    (expected) => document.querySelector("h1")?.textContent === expected,
    HEADING[locale],
    { timeout: 25000 },
  );
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="language-learning-radio"]', { timeout: 20000 });
console.log("START " + JSON.stringify(await page.evaluate(() => document.querySelector("h1")?.textContent)));

for (const [label, locale] of [["English", "en"], ["Tiếng Việt", "vi"]]) {
  await switchTo(page, label, locale);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(500);
  console.log(locale.toUpperCase() + "_360 " + JSON.stringify(await page.evaluate(measure)));
  await page.screenshot({ path: `${OUT}/lang-mobile-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(400);
}

// Restore → Korean (critical: leave the test account as it was).
await switchTo(page, "한국어", "ko");
console.log("RESTORED " + JSON.stringify(await page.evaluate(() => document.querySelector("h1")?.textContent)));

await browser.close();
