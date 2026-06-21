// Warm (pre-compile) authed routes so the formal Playwright spec's 15s nav
// timeout isn't exceeded by first-compile on the slow drive.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3210";
const storage = JSON.parse(readFileSync(".scratch/student-state.json", "utf8"));
const ROUTES = ["/practice/weakness", "/practice/next", "/library", "/profile",
  "/settings/account", "/settings/learning", "/settings/language", "/dashboard"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: storage, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120_000);
for (const r of ROUTES) {
  const t = Date.now();
  try {
    const resp = await page.goto(BASE + r, { waitUntil: "networkidle" });
    console.log(`warm ${r.padEnd(22)} status=${resp?.status()} ${Date.now() - t}ms url=${new URL(page.url()).pathname}`);
  } catch (e) {
    console.log(`warm ${r.padEnd(22)} ERR ${String(e).split("\n")[0]}`);
  }
}
await ctx.close();
await browser.close();
