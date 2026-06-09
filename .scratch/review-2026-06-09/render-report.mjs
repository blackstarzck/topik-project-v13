import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const file = pathToFileURL(path.resolve("docs/design-review-result/20260609-wireframe-page-review/report.html")).href;
const b = await chromium.launch({ headless: true });
for (const w of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(file, { waitUntil: "networkidle", timeout: 15000 });
  await p.waitForTimeout(400);
  const h1 = await p.locator("h1").first().innerText().catch(() => "?");
  const rows = await p.locator("table tbody tr").count();
  const bodyLen = await p.evaluate(() => document.body.innerText.length);
  await p.screenshot({ path: `.scratch/review-2026-06-09/report-preview-${w}.png`, fullPage: w === 1280 });
  console.log(`w=${w} h1=${JSON.stringify(h1.slice(0, 30))} tableRows=${rows} bodyLen=${bodyLen} pageerrors=${errs.length}`);
  await ctx.close();
}
await b.close();
console.log("DONE");
