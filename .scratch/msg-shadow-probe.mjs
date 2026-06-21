import { chromium } from "@playwright/test";

const OUT =
  "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/0a74f8e4-d5a3-49f0-ac5f-7d49a2c65685/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/settings/language";
const LABEL = process.argv[2] ?? "current";
const VW = Number(process.argv[3] ?? 1280);
const VH = process.argv[3] ? 740 : 900;

function diag() {
  // Find the actual message notice node (themed toast).
  const notice = document.querySelector(".ant-message-notice");
  const content = document.querySelector(".ant-message-notice-content");
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);

  const read = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      className: el.className,
      boxShadow: cs.boxShadow,
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
    };
  };

  return {
    foundNotice: !!notice,
    foundContent: !!content,
    notice: read(notice),
    content: read(content),
    vars: {
      "--ant-box-shadow": rootStyle.getPropertyValue("--ant-box-shadow").trim(),
      "--ant-box-shadow-secondary": rootStyle
        .getPropertyValue("--ant-box-shadow-secondary")
        .trim(),
      "--ant-box-shadow-tertiary": rootStyle
        .getPropertyValue("--ant-box-shadow-tertiary")
        .trim(),
      "--ant-message-box-shadow": rootStyle
        .getPropertyValue("--ant-message-box-shadow")
        .trim(),
      "--app-shadow-elevated": rootStyle
        .getPropertyValue("--app-shadow-elevated")
        .trim(),
    },
  };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });

if (/\/login/.test(page.url())) {
  console.log("AUTH_EXPIRED redirected to login: " + page.url());
  await browser.close();
  process.exit(2);
}

await page.waitForSelector('[data-testid="language-save"]', { timeout: 15000 });

// Make the form dirty so the save button enables. Toggle a content-pref
// Segmented (feedback display) — content prefs don't trigger a locale refresh,
// so the success toast stays visible for inspection.
await page.click(
  '[data-testid="language-feedback-display"] .ant-segmented-item:not(.ant-segmented-item-selected)',
);
await page.waitForSelector('[data-testid="language-save"]:not([disabled])', {
  timeout: 8000,
});
await page.click('[data-testid="language-save"]');

// Wait for the themed toast to appear.
await page.waitForSelector(".ant-message-notice", { timeout: 8000 });
await page.waitForTimeout(400);

const result = await page.evaluate(diag);
console.log("DIAG_" + LABEL + " " + JSON.stringify(result, null, 2));

// Tight screenshot of the toast area (top-center).
await page.screenshot({
  path: `${OUT}/msg-${LABEL}-full.png`,
  clip:
    VW >= 800
      ? { x: 240, y: 0, width: 800, height: 140 }
      : { x: 0, y: 0, width: VW, height: 180 },
});
await page.screenshot({ path: `${OUT}/msg-${LABEL}-page.png` });

await browser.close();
