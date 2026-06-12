import { chromium } from "playwright";
import path from "node:path";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const EVID = "docs/qa/reports/qa-report-20260612-1205-evidence";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
const out = {};
async function probe(route, slug) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 120)));
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const bodyText = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
  const retryBtn = await page.getByRole("button", { name: /다시 시도|재시도|다시/ }).count();
  const listLink = await page.locator('a[href*="practice/problems"], a[href*="dashboard"]').count();
  if (slug) await page.screenshot({ path: path.join(EVID, slug + ".png") });
  await page.close();
  return { route, bodyText, recoveryButtons: retryBtn, recoveryLinks: listLink, consoleErrors: errs };
}
// malformed (non-uuid)
out.malformed = await probe("/writing/short-answer-writing-51?problem=does-not-exist-123", "state-s3-malformed");
// valid-format uuid that does not exist
out.validUuidNonexistent = await probe("/writing/short-answer-writing-51?problem=11111111-1111-4111-8111-111111111111", "state-s3-valid-uuid");
await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
