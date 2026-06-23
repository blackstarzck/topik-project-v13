import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outDir = path.join(root, ".scratch", "nickname-ui-states");
const storageState = path.join(root, "tests", "e2e", "auth-state", "student.json");
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

const viewports = [
  { name: "desktop", viewport: { width: 1280, height: 800 } },
  { name: "mobile", viewport: { width: 360, height: 720 } },
];

const states = [
  {
    name: "01-default-help",
    description: "기본 도움말",
    nickname: null,
  },
  {
    name: "02-too-short",
    description: "2자 미만",
    nickname: "a",
  },
  {
    name: "03-checking",
    description: "확인 중",
    nickname: "capture-checking",
    rpc: "delay-available",
    waitFor: "닉네임을 확인하고 있어요.",
  },
  {
    name: "04-available",
    description: "사용 가능",
    nickname: `capture-ok-${Date.now().toString(36)}`,
    rpc: "available",
    waitFor: "사용 가능한 닉네임이에요.",
  },
  {
    name: "05-taken",
    description: "중복",
    nickname: "capture-taken",
    rpc: "taken",
    waitFor: "이미 사용 중인 닉네임이에요.",
  },
  {
    name: "06-check-failed",
    description: "확인 실패",
    nickname: "capture-failed",
    rpc: "failed",
    waitFor: "지금은 확인할 수 없어요. 저장할 때 다시 확인할게요.",
  },
  {
    name: "07-save-conflict",
    description: "저장 시 unique 충돌",
    nickname: `capture-conflict-${Date.now().toString(36)}`,
    rpc: "available",
    saveConflict: true,
    waitFor: "이미 사용 중인 닉네임이에요.",
  },
];

await mkdir(outDir, { recursive: true });

function rpcFulfill(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body,
  });
}

async function installRoutes(page, state) {
  if (state.rpc) {
    await page.route("**/rest/v1/rpc/is_nickname_available", async (route) => {
      if (state.rpc === "delay-available") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return rpcFulfill(route, "true");
      }
      if (state.rpc === "available") return rpcFulfill(route, "true");
      if (state.rpc === "taken") return rpcFulfill(route, "false");
      return rpcFulfill(
        route,
        JSON.stringify({ code: "PGRST500", message: "mock rpc failure" }),
        500,
      );
    });
  }

  if (state.saveConflict) {
    await page.route("**/rest/v1/profiles**", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      return rpcFulfill(
        route,
        JSON.stringify({
          code: "23505",
          message:
            'duplicate key value violates unique constraint "profiles_nickname_lower_uniq"',
          details:
            'Key (lower(nickname::text)) already exists in constraint "profiles_nickname_lower_uniq".',
        }),
        409,
      );
    });
  }
}

async function waitForReady(page) {
  await page.goto(`${baseURL}/profile`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/profile/);
  await page.locator('input[maxlength="20"]').waitFor({ state: "visible" });
}

async function captureState(browser, viewportConfig, state) {
  const context = await browser.newContext({
    viewport: viewportConfig.viewport,
    storageState,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await installRoutes(page, state);
  await waitForReady(page);

  const nicknameInput = page.locator('input[maxlength="20"]');
  if (state.nickname !== null) {
    await nicknameInput.fill(state.nickname);
  }

  if (state.name === "02-too-short") {
    await page.getByText("닉네임은 2자 이상 입력해 주세요.").waitFor();
  }

  if (state.name === "03-checking") {
    await page.getByText(state.waitFor).waitFor({ timeout: 2000 });
  }

  if (["04-available", "05-taken", "06-check-failed"].includes(state.name)) {
    await page.getByText(state.waitFor).waitFor({ timeout: 4000 });
  }

  if (state.saveConflict) {
    await page.getByText("사용 가능한 닉네임이에요.").waitFor({ timeout: 4000 });
    await page.getByRole("button", { name: "프로필 저장" }).click();
    await page.getByText(state.waitFor).first().waitFor({ timeout: 4000 });
  }

  await nicknameInput.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(100);

  const fileName = `${viewportConfig.name}-${state.name}.png`;
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath });
  await context.close();

  return { fileName, description: state.description, errors };
}

const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of viewports) {
    for (const state of states) {
      results.push(await captureState(browser, viewport, state));
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ outDir, results }, null, 2));
