import { chromium } from "@playwright/test";

const OUT =
  "C:/Users/buche/AppData/Local/Temp/claude/D--workspace-topik-project-v13/490b03ba-c24f-42bb-84e8-aa55c93899c8/scratchpad";
const STATE = "D:/workspace/topik-project-v13/tests/e2e/auth-state/student.json";
const URL = "http://127.0.0.1:3000/growth";

function probe() {
  // AntD Segmented renders a .ant-segmented container; Radio.Group button would be .ant-radio-group.
  const seg = document.querySelector(".ant-segmented");
  const radioGroup = document.querySelector(".ant-segmented, .ant-radio-group");
  const labels = seg
    ? Array.from(seg.querySelectorAll(".ant-segmented-item-label")).map((n) =>
        n.textContent.trim(),
      )
    : [];
  const selected = seg
    ? (seg.querySelector(".ant-segmented-item-selected .ant-segmented-item-label")
        ?.textContent.trim() ?? null)
    : null;
  // empty-state retry button (only present when no trend data)
  const retry = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === "다시 시도",
  );
  const retryPrimary = retry
    ? retry.classList.contains("ant-btn-primary")
    : null;
  return {
    hasSegmented: !!seg,
    isRadioGroup: !!document.querySelector(".ant-radio-group"),
    segLabels: labels,
    segSelected: selected,
    retryPresent: !!retry,
    retryIsPrimary: retryPrimary,
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("text=성장 추세 차트", { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/growth-desktop.png`, fullPage: true });
console.log("DESKTOP_1280 " + JSON.stringify(await page.evaluate(probe)));

await page.setViewportSize({ width: 360, height: 740 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/growth-mobile.png`, fullPage: true });
console.log("MOBILE_360 " + JSON.stringify(await page.evaluate(probe)));

await browser.close();
