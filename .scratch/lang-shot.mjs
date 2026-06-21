import { chromium } from "@playwright/test";

const OUT = "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/9f835a76-4c31-48f5-a189-93a4885dce3d/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/language";

function measure() {
  const de = document.documentElement;
  const seg = (tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { scrollW: el.scrollWidth, clientW: el.clientWidth, rectW: Math.round(r.width) };
  };
  return {
    pageOverflow: de.scrollWidth - de.clientWidth,
    ui: seg("language-ui-radio"),
    learning: seg("language-learning-radio"),
    feedback: seg("language-feedback-display"),
    difficulty: seg("language-example-difficulty"),
    explanation: seg("language-explanation-length"),
  };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="language-learning-radio"]', { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/lang-desktop.png`, fullPage: true });
console.log("DESKTOP_1280 " + JSON.stringify(await page.evaluate(measure)));

await page.setViewportSize({ width: 360, height: 740 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/lang-mobile.png`, fullPage: true });
console.log("MOBILE_360 " + JSON.stringify(await page.evaluate(measure)));

await browser.close();
