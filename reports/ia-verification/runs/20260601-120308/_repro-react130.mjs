// Reproduce React #130 on the DEV server (non-minified) to get the component name.
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const STATE = "tests/e2e/auth-state/student.json";
const PAGES = ["/growth", "/paywall", "/subscription", "/writing/51"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });

for (const p of PAGES) {
  const page = await ctx.newPage();
  const msgs = [];
  page.on("console", (m) => {
    if (m.type() === "error") msgs.push("CONSOLE.ERROR: " + m.text());
  });
  page.on("pageerror", (e) => msgs.push("PAGEERROR: " + (e.stack || e.message)));
  let status = "?";
  let finalUrl = "";
  let body = "";
  try {
    const r = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 35000 });
    status = r ? r.status() : "?";
    finalUrl = page.url();
    if (status === 500) body = (await page.content()).replace(/\s+/g, " ");
  } catch (e) {
    msgs.push("GOTO ERROR: " + e.message);
  }
  await page.waitForTimeout(4000);
  console.log("\n===== " + p + "  (HTTP " + status + ", final " + finalUrl + ") =====");
  const filtered = msgs.filter((m) => !/webpack-hmr|HMR|Download the React DevTools|Fast Refresh/i.test(m));
  if (filtered.length === 0) console.log("(no non-HMR errors)");
  for (const m of filtered) console.log(m.slice(0, 1500));
  if (body) {
    const mm = body.match(/(Error:|type is invalid|got: undefined|Check the render method of|export your component)[^<]{0,400}/i);
    console.log("500-BODY-HINT: " + (mm ? mm[0].slice(0, 400) : body.slice(0, 400)));
  }
  await page.close();
}

await browser.close();
console.log("\n[repro done]");
