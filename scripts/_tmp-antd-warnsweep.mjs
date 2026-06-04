// Runtime antd-deprecation-warning sweep across routes (the real oracle).
// Collects any console message containing "deprecated" / "[antd". Also reports
// non-antd runtime errors so pre-existing issues are visible (not masked).
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

const PUBLIC = ["/", "/login", "/signup", "/reset-password"];
const AUTHED = [
  "/dashboard", "/library", "/profile", "/growth",
  "/practice/recommendations", "/practice/weakness", "/practice/problems",
  "/settings/notifications", "/settings/language", "/subscription", "/paywall",
  "/writing/answer-writing-52", "/writing/long-form-writing-53",
];

const antdWarns = new Map(); // text -> Set(routes)
const otherErrs = new Map();

async function visit(ctx, route) {
  const page = await ctx.newPage();
  const handler = (m) => {
    const t = m.text();
    if (/getComputedStyle|Download the React DevTools|\[Fast Refresh\]/.test(t)) return;
    if (/deprecated|\[antd/i.test(t)) {
      const k = t.slice(0, 120);
      if (!antdWarns.has(k)) antdWarns.set(k, new Set());
      antdWarns.get(k).add(route);
    } else if (m.type() === "error") {
      const k = t.slice(0, 100);
      if (!otherErrs.has(k)) otherErrs.set(k, new Set());
      otherErrs.get(k).add(route);
    }
  };
  page.on("console", handler);
  page.on("pageerror", (e) => {
    const k = "pageerror: " + e.message.slice(0, 90);
    if (!otherErrs.has(k)) otherErrs.set(k, new Set());
    otherErrs.get(k).add(route);
  });
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
  } catch (e) {
    otherErrs.set("GOTO_FAIL " + route + ": " + e.message.slice(0, 60), new Set([route]));
  }
  await page.close();
}

const browser = await chromium.launch();
const pub = await browser.newContext();
for (const r of PUBLIC) await visit(pub, r);
await pub.close();
const auth = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json" });
for (const r of AUTHED) await visit(auth, r);
await auth.close();
await browser.close();

console.log("\n=== antd DEPRECATION warnings (should be EMPTY) ===");
if (antdWarns.size === 0) console.log("  ✓ none");
for (const [t, routes] of antdWarns) console.log(`  ✗ ${t}\n      routes: ${[...routes].join(", ")}`);

console.log("\n=== other runtime errors (context; pre-existing issues surfaced) ===");
if (otherErrs.size === 0) console.log("  none");
for (const [t, routes] of otherErrs) console.log(`  • ${t}\n      routes: ${[...routes].join(", ")}`);
