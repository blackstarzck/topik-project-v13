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
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  let status = null;
  page.on("response", (r) => { if (r.url().startsWith(BASE + route.split("?")[0])) status = r.status(); });
  const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 20000 }).catch(() => null);
  if (resp && status == null) status = resp.status();
  await page.waitForTimeout(500);
  const finalUrl = page.url().replace(BASE, "");
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
  const has404Marker = /404|찾을 수 없|페이지를 찾|존재하지 않|not found|돌아가기|문제 목록|다시 시도|재시도/i.test(bodyText);
  if (slug) await page.screenshot({ path: path.join(EVID, slug + ".png") });
  await page.close();
  return { route, status, finalUrl, has404OrRecoveryMarker: has404Marker, consoleErrors: errs.filter(e=>!e.includes("favicon")), bodyTextSnippet: bodyText.replace(/\s+/g, " ").slice(0, 200) };
}

out.ACC_S5_foreign_feedback = await probe("/writing/feedback/short/00000000-0000-4000-8000-000000000000", "acc-s5-foreign-feedback");
out.STATE_S3_bad_problem = await probe("/writing/short-answer-writing-51?problem=does-not-exist-123", null);
out.STATE_S4_nonexistent_route = await probe("/this-route-does-not-exist-qa", "state-s4-404");

await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
