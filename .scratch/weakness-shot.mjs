import { chromium } from "@playwright/test";

const OUT =
  "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/9073bd0d-b931-467f-925d-f41850ca4a49/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/practice/weakness";

const browser = await chromium.launch();

// Desktop
const ctxD = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const pD = await ctxD.newPage();
await pD.goto(URL, { waitUntil: "networkidle" });
await pD.waitForTimeout(800);
await pD.screenshot({ path: `${OUT}/weakness-desktop.png`, fullPage: true });

// Report what the "추천 문제" card head looks like + recommendation count.
const info = await pD.evaluate(() => {
  const heads = Array.from(
    document.querySelectorAll(".ant-card-head-title"),
  ).map((el) => el.textContent?.trim());
  const recCards = document.querySelectorAll('[data-testid^="weakness-rec-"]').length;
  const primaryStart = !!document.querySelector('[data-testid="weakness-primary-start"]');
  // Any footer actions present on app cards?
  const footerActions = document.querySelectorAll(".app-card .ant-card-actions").length;
  return { heads, recCards, primaryStart, footerActions };
});
console.log("WEAKNESS_INFO " + JSON.stringify(info));

await ctxD.close();

// Mobile
const ctxM = await browser.newContext({
  storageState: STATE,
  viewport: { width: 360, height: 720 },
  deviceScaleFactor: 2,
});
const pM = await ctxM.newPage();
await pM.goto(URL, { waitUntil: "networkidle" });
await pM.waitForTimeout(800);
await pM.screenshot({ path: `${OUT}/weakness-mobile.png`, fullPage: true });
await ctxM.close();

await browser.close();
console.log("DONE");
