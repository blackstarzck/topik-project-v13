// Phase 6 smoke — visits every public + auth-redirecting route and records
// the HTTP status + first console error per page. Not a full E2E suite (OOS-4)
// — just the missing "boot smoke" gate from Plan rev4.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

// Routes that should return 200 directly (public).
const PUBLIC_ROUTES = ["/", "/login", "/sign-up", "/password-reset"];

// Routes behind auth — middleware (src/proxy.ts) should 307 → /login.
const PRIVATE_ROUTES = [
  "/dashboard",
  "/library",
  "/library?tab=reports",
  "/library?tab=problems",
  "/library?tab=exports",
  "/practice/weakness",
  "/practice/next",
  "/practice/problems",
  "/settings/language",
  "/settings/notifications",
  "/profile",
];

const results = [];

async function visit(page, route) {
  const consoleErrors = [];
  page.on("pageerror", (e) =>
    consoleErrors.push(`PAGEERR: ${e.message.slice(0, 200)}`),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`CONSOLE: ${msg.text().slice(0, 200)}`);
    }
  });

  let status = 0;
  let finalUrl = "";
  try {
    const resp = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    status = resp ? resp.status() : 0;
    finalUrl = page.url().replace(BASE, "");
  } catch (e) {
    status = -1;
    finalUrl = `nav-fail:${e.message.slice(0, 60)}`;
  }

  results.push({ route, status, finalUrl, errors: consoleErrors });
}

const browser = await chromium.launch();
const context = await browser.newContext();

for (const r of PUBLIC_ROUTES) {
  const page = await context.newPage();
  await visit(page, r);
  await page.close();
}

for (const r of PRIVATE_ROUTES) {
  const page = await context.newPage();
  await visit(page, r);
  await page.close();
}

await browser.close();

let bad = 0;
console.log("\n=== Phase 6 boot smoke results ===\n");
for (const r of results) {
  const ok =
    (PUBLIC_ROUTES.includes(r.route.split("?")[0]) && r.status === 200) ||
    (!PUBLIC_ROUTES.includes(r.route.split("?")[0]) &&
      (r.status === 200 || r.finalUrl.startsWith("/login")));
  if (!ok) bad += 1;
  console.log(
    `${ok ? "OK " : "FAIL"} ${r.route.padEnd(36)} status=${String(r.status).padEnd(4)} -> ${r.finalUrl}`,
  );
  for (const err of r.errors.slice(0, 3)) {
    console.log(`     · ${err}`);
  }
}
console.log(`\n${results.length - bad}/${results.length} OK`);
process.exit(bad === 0 ? 0 : 1);
