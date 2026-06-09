// Capture hydrated evidence screenshots for the wireframe UI audit report.
// Reuses the running dev server. Authed pages use 127.0.0.1 + storageState
// (cookie host match); public pages use localhost. Writes PNGs under the report
// screenshots dir (gitignored) + prints a manifest line per shot. READ-ONLY app.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE = path.join("tests", "e2e", "auth-state", "student.json");
const REPORT_DIR = path.join("docs", "design-review-result", "wireframe-ui-audit", "2026-06-09");
const SHOTS = path.join(REPORT_DIR, "screenshots");

// Markers that prove the writing editor is in the BLOCKED/empty state (the old P1).
const BLOCKED_MARKERS = ["불러오지 못", "제출할 수 없", "조건 정보를"];

const TARGETS = [
  { folder: "08-D-01-short-answer-writing-51", route: "/writing/short-answer-writing-51", authed: true, vps: [1280], writing: true },
  { folder: "09-D-02-answer-writing-52", route: "/writing/answer-writing-52", authed: true, vps: [1280, 360], writing: true },
  { folder: "10-D-03-long-form-writing-53", route: "/writing/long-form-writing-53", authed: true, vps: [1280], writing: true },
  { folder: "11-D-04-essay-writing-54", route: "/writing/essay-writing-54", authed: true, vps: [1280], writing: true },
  { folder: "06-C-02-problem-list", route: "/practice/problems", authed: true, vps: [1280], writing: false },
  { folder: "38-X-16-password-reset-confirm", route: "/password-reset/confirm", authed: false, vps: [1280], writing: false },
];

const browser = await chromium.launch({ headless: true });
const manifest = [];
try {
  for (const t of TARGETS) {
    const origin = t.authed ? "http://127.0.0.1:3000" : "http://localhost:3000";
    await mkdir(path.join(SHOTS, t.folder), { recursive: true });
    for (const width of t.vps) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        storageState: t.authed ? STORAGE : undefined,
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e.message).slice(0, 200)));
      let status = 0;
      try {
        const resp = await page.goto(origin + t.route, { waitUntil: "networkidle", timeout: 20000 });
        status = resp ? resp.status() : 0;
      } catch (e) { consoleErrors.push("goto: " + String(e.message).slice(0, 150)); }
      await page.waitForTimeout(900);
      const finalUrl = page.url();
      const bodyText = await page.evaluate(() => (document.body?.innerText || "")).catch(() => "");
      const errorOverlay = await page.evaluate(() => {
        if (document.querySelector("[data-nextjs-dialog], #nextjs__container_errors")) return true;
        const t = document.body?.innerText || "";
        return /Unhandled Runtime Error|Build Error|Failed to compile|Application error/i.test(t);
      }).catch(() => false);
      const blocked = BLOCKED_MARKERS.some((m) => bodyText.includes(m));
      const redirectedToLogin = /\/login(\?|$)/.test(finalUrl);
      const rel = `screenshots/${t.folder}/current-${width}.png`;
      await page.screenshot({ path: path.join(REPORT_DIR, rel), fullPage: true }).catch((e) => consoleErrors.push("shot: " + e.message));
      const row = { folder: t.folder, route: t.route, vp: width, status, finalUrl, redirectedToLogin, errorOverlay, blocked: t.writing ? blocked : null, bodyLen: bodyText.length, consoleErr: consoleErrors.length, errors: consoleErrors.slice(0, 5), rel };
      manifest.push(row);
      console.log(`${t.folder} ${width} status=${status} login=${redirectedToLogin} overlay=${errorOverlay} ${t.writing ? "blocked=" + blocked + " " : ""}bodyLen=${bodyText.length} err=${consoleErrors.length}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); }

await writeFile(path.join(".scratch", "audit-2026-06-09", "capture-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("\nMANIFEST written. writing-blocked any? ", manifest.filter((m) => m.blocked === true).map((m) => m.folder + ":" + m.vp));
