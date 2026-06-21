// Phase 2 probe: find a real submission for the student via /library, then
// render the long/short feedback + comparison report pages to verify the
// width unification. Falls back to reporting "no data" if the account has none.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3210";
const OUT = ".scratch/shots";
mkdirSync(OUT, { recursive: true });
const storage = JSON.parse(readFileSync(".scratch/student-state.json", "utf8"));
const f = (n) => (n === null || n === undefined ? "—" : Math.round(n));

async function measure(page) {
  return page.evaluate(() => {
    const body = document.querySelector('[data-testid="workspace-page-body"]');
    const shell = document.querySelector('[data-testid="feedback-page-shell"]');
    const hdr = document.querySelector('[data-testid="feedback-page-header"] > div');
    const content = document.querySelector(".app-workspace-content");
    const root = document.documentElement;
    const pick = (el) => (el ? el.getBoundingClientRect() : null);
    const capped = Array.from(document.querySelectorAll(".app-workspace-body--workspace")).map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), l: Math.round(r.left) };
    });
    const b = pick(body), c = pick(content);
    return {
      hasBody: !!body, hasShell: !!shell,
      bodyW: b?.width ?? null, bodyL: b?.left ?? null,
      contentW: c?.width ?? null, contentL: c?.left ?? null,
      cappedBlocks: capped,
      overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
    };
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: storage, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(45_000);

console.log("goto /library …");
await page.goto(BASE + "/library", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/library-desktop.png` });
const hrefs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")),
);
const feedbackLinks = [...new Set(hrefs.filter((h) => h && h.includes("/writing/feedback/")))];
const reportLinks = [...new Set(hrefs.filter((h) => h && h.includes("/writing/reports/")))];
console.log("feedback links:", feedbackLinks.slice(0, 8));
console.log("report links:", reportLinks.slice(0, 8));

const targets = [];
const short = feedbackLinks.find((h) => h.includes("/feedback/short/"));
const long = feedbackLinks.find((h) => h.includes("/feedback/long/"));
const compare = reportLinks.find((h) => h.includes("/compare"));
if (short) targets.push({ slug: "short-feedback", href: short });
if (long) targets.push({ slug: "long-feedback", href: long });
if (compare) targets.push({ slug: "comparison-report", href: compare });

for (const t of targets) {
  try {
    const url = t.href.startsWith("http") ? t.href : BASE + t.href;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const m = await measure(page);
    await page.screenshot({ path: `${OUT}/${t.slug}-desktop.png`, fullPage: false });
    console.log(`[${t.slug}] ${t.href} -> body(w=${f(m.bodyW)},l=${f(m.bodyL)}) content(w=${f(m.contentW)},l=${f(m.contentL)}) shell=${m.hasShell} capped=${JSON.stringify(m.cappedBlocks)} ovf=${f(m.overflow)}`);
  } catch (e) {
    console.log(`[${t.slug}] ERR ${String(e).split("\n")[0]}`);
  }
}
if (targets.length === 0) console.log("NO Phase-2 data available for this student account.");
await ctx.close();
await browser.close();
