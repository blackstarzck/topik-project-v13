// Focused /library investigation: capture full console errors with location/stack
// to determine the source of "Maximum update depth exceeded".
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json" });
const page = await ctx.newPage();
const seen = new Set();
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/getComputedStyle|DevTools/.test(t)) return;
  const loc = m.location();
  const key = t.slice(0, 60);
  if (seen.has(key)) return;
  seen.add(key);
  console.log("\nERROR:", t.slice(0, 300));
  console.log("  at", loc.url + ":" + loc.lineNumber);
});
page.on("pageerror", (e) => {
  console.log("\nPAGEERROR:", e.message);
  console.log((e.stack || "").split("\n").slice(0, 12).join("\n"));
});
await page.goto(`${BASE}/library`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);
console.log("\nfinal URL:", page.url());
await browser.close();
