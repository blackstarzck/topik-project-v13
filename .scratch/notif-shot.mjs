import { chromium } from "@playwright/test";

const OUT = "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/9f835a76-4c31-48f5-a189-93a4885dce3d/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/notifications";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="notification-routine-row-frequency"]', { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/notif-desktop.png`, fullPage: true });

const segW = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="notification-routine-row-frequency"] .ant-segmented');
  if (!el) return null;
  return { rectW: Math.round(el.getBoundingClientRect().width) };
});
console.log("NOTIF_FREQ_SEGMENTED " + JSON.stringify(segW));

await browser.close();
