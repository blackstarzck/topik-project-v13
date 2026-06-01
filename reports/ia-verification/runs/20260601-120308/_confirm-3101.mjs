import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3101";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json" });
for (const p of ["/growth", "/writing/51", "/admin/org"]) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + (e.message || "")));
  let status = "?";
  try { const r = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 30000 }); status = r ? r.status() : "?"; } catch (e) { errs.push("GOTO: " + e.message); }
  await page.waitForTimeout(3500);
  const react130 = errs.filter((e) => /React error #130|type is invalid|Minified React error/i.test(e));
  console.log(`${p} HTTP ${status} | total console.errors=${errs.length} | React#130 errors=${react130.length}`);
  for (const e of react130) console.log("   #130: " + e.slice(0, 120));
  await page.close();
}
await browser.close();
