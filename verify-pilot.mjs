// UI redesign pilot — prod (next start) Playwright verification.
// PLAN §Phase 2 auto-completion gate: light/dark <html> bridge assert, console
// errors 0, no horizontal scroll at 360/768/1280, reduced-motion respected,
// screenshots {light,dark}×{360,768,1280} → docs/ui-redesign/pilot-shots/.
//
// Run against a running `next start`:  node verify-pilot.mjs http://localhost:3100
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS_DIR = "docs/ui-redesign/pilot-shots";

const TARGETS = [
  { name: "login", path: "/login" },
  { name: "dashboard", path: "/dev-preview/dashboard" },
];
const WIDTHS = [360, 768, 1280];
const EXPECTED = {
  light: { "--app-color-bg-container": "#ffffff", "--app-color-primary": "#1677ff" },
  dark: { "--app-color-bg-container": "#141414", "--app-color-primary": "#1668dc" },
};

const failures = [];
const results = [];

function record(ok, label, detail = "") {
  results.push({ ok, label, detail });
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

await mkdir(SHOTS_DIR, { recursive: true });
const browser = await chromium.launch();

for (const appearance of ["light", "dark"]) {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "theme-appearance", value: appearance, url: BASE },
  ]);

  for (const target of TARGETS) {
    for (const width of WIDTHS) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      const consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

      const url = `${BASE}${target.path}`;
      const resp = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      const label = `${target.name}/${appearance}/${width}`;

      // landed on the intended path (no auth redirect to /login for dashboard)
      const landedPath = new URL(page.url()).pathname;
      record(
        landedPath === target.path,
        `${label} landed on ${target.path}`,
        `got ${landedPath} (status ${resp?.status()})`,
      );

      // bridge vars resolved on <html> for this appearance
      const probe = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          bg: cs.getPropertyValue("--app-color-bg-container").trim(),
          primary: cs.getPropertyValue("--app-color-primary").trim(),
          colorScheme: cs.colorScheme,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      });
      const exp = EXPECTED[appearance];
      record(
        probe.bg.toLowerCase() === exp["--app-color-bg-container"],
        `${label} --app-color-bg-container`,
        `expected ${exp["--app-color-bg-container"]}, got ${probe.bg}`,
      );
      record(
        probe.primary.toLowerCase() === exp["--app-color-primary"],
        `${label} --app-color-primary`,
        `expected ${exp["--app-color-primary"]}, got ${probe.primary}`,
      );
      record(
        probe.colorScheme.includes(appearance),
        `${label} color-scheme`,
        `got ${probe.colorScheme}`,
      );

      // no horizontal scroll (allow 1px rounding)
      record(
        probe.scrollW <= probe.innerW + 1,
        `${label} no horizontal scroll`,
        `scrollW ${probe.scrollW} > innerW ${probe.innerW}`,
      );

      // console errors 0
      record(
        consoleErrors.length === 0,
        `${label} console errors 0`,
        consoleErrors.slice(0, 3).join(" | "),
      );

      await page.screenshot({
        path: `${SHOTS_DIR}/${target.name}-${appearance}-${width}.png`,
        fullPage: true,
      });
      await page.close();
    }
  }
  await context.close();
}

// reduced-motion respected: emulate reduce, assert media matches + a transition
// is effectively stopped by the global.css block.
{
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  const rm = await page.evaluate(() => {
    const matches = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const btn = document.querySelector("button");
    const dur = btn ? getComputedStyle(btn).transitionDuration : "none";
    // parse first duration value to seconds
    const sec = parseFloat(dur);
    return { matches, dur, sec: Number.isNaN(sec) ? null : sec };
  });
  record(rm.matches === true, "reduced-motion media matches", `got ${rm.matches}`);
  record(
    rm.sec !== null && rm.sec <= 0.05,
    "reduced-motion near-stops transitions",
    `button transition-duration ${rm.dur}`,
  );
  await context.close();
}

await browser.close();

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failures }, null, 2));
if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nALL PILOT CHECKS PASSED");
