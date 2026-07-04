import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // CI without .env.local will skip through the explicit env guard below.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const RUN_TOKEN = `analysis-page-state-${randomUUID()}`;
const analysisMessages = (
  JSON.parse(
    readFileSync(path.join(process.cwd(), "messages", "ko.json"), "utf8"),
  ) as {
    feedback: {
      analysis: {
        title: string;
        subtitle: string;
        expectedTime: string;
      };
    };
  }
).feedback.analysis;

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for writing analysis state e2e",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSubmittedRow(answerToken: string) {
  const sb = serviceClient();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { data, error } = await sb
      .from("writing_submissions")
      .select("id")
      .like("answer_text", `%${answerToken}%`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
    await wait(500);
  }

  throw new Error("Timed out waiting for the analysis state submission row");
}

async function fillShortAnswer51(
  page: Page,
  firstAnswer: string,
  secondAnswer: string,
) {
  const answerField = page.locator("textarea").first();
  await answerField.fill(firstAnswer);

  const tabs = page.getByRole("tab");
  if ((await tabs.count()) > 1) {
    await tabs.nth(1).click();
    await answerField.fill(secondAnswer);
  }

  await expect(page.getByRole("button", { name: /제출하기/ })).toBeEnabled();
}

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "writing analysis state e2e requires Supabase service credentials for cleanup",
);

test.afterAll(async () => {
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  await serviceClient()
    .from("writing_submissions")
    .delete()
    .like("answer_text", `%${RUN_TOKEN}%`);
});

test("writing submit keeps analysis state above the read-only answer", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "analysis state smoke runs on desktop and mobile",
  );

  const answerToken = `${RUN_TOKEN}-${testInfo.project.name}-${testInfo.retry}`;
  const answerText = `Answer ${answerToken}.`;

  await page.route(
    "**/api/writing/evaluation-status?submissionId=*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ feedback_status: "analyzing" }),
      });
    },
  );

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await fillShortAnswer51(page, answerText, "Please send the needed form.");
  await page.getByRole("button", { name: /제출하기/ }).click();
  await page.getByTestId("submission-confirm-submit").click();

  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);
  await expect(page.getByTestId("analysis-loading-modal")).toHaveCount(0);
  await expect(page.getByTestId("analysis-state-card")).toBeVisible();
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: analysisMessages.title }),
  ).toBeVisible();
  await expect(page.getByTestId("analysis-loading-background")).toHaveCount(0);
  await expect(page.getByText(analysisMessages.subtitle)).toBeVisible();
  await expect(page.getByText(analysisMessages.expectedTime)).toBeVisible();
  await expect(page.getByTestId("analysis-slow-handoff")).toHaveCount(0);

  const assetSrc = await page
    .getByTestId("analysis-state-asset")
    .getAttribute("src");
  expect(assetSrc).toMatch(
    /(?:\/assets\/state\/refresh\.svg|%2Fassets%2Fstate%2Frefresh\.svg)/,
  );

  const [pageBox, stateBox] = await Promise.all([
    page.getByTestId("analysis-loading-page").boundingBox(),
    page.getByTestId("analysis-state-card").boundingBox(),
  ]);
  expect(pageBox, "analysis page box").toBeTruthy();
  expect(stateBox, "analysis state card box").toBeTruthy();
  const pageCenterX = pageBox!.x + pageBox!.width / 2;
  const stateCenterX = stateBox!.x + stateBox!.width / 2;
  expect(Math.abs(stateCenterX - pageCenterX)).toBeLessThanOrEqual(2);

  await waitForSubmittedRow(answerToken);
});

test("writing submit shows failure state without the read-only answer", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "failure state smoke runs on desktop and mobile",
  );

  const answerToken = `${RUN_TOKEN}-failed-${testInfo.project.name}-${testInfo.retry}`;
  const answerText = `Failed ${answerToken}.`;

  await page.route(
    "**/api/writing/evaluation-status?submissionId=*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ feedback_status: "failed" }),
      });
    },
  );

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await fillShortAnswer51(page, answerText, "Please send the new file.");
  await page.getByRole("button", { name: /제출하기/ }).click();
  await page.getByTestId("submission-confirm-submit").click();

  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);
  await expect(page.getByTestId("analysis-state-card")).toBeVisible();
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);
  await expect(page.getByTestId("analysis-loading-background")).toHaveCount(0);
  await expect(page.getByTestId("analysis-loading-retry")).toBeVisible();
  await expect(
    page.locator('[data-testid="analysis-failed-description"] br'),
  ).toHaveCount(1);

  const assetSrc = await page
    .getByTestId("analysis-state-asset")
    .getAttribute("src");
  expect(assetSrc).toMatch(
    /(?:\/assets\/state\/fail\.svg|%2Fassets%2Fstate%2Ffail\.svg)/,
  );

  const [assetBox, actionsBox] = await Promise.all([
    page.getByTestId("analysis-state-asset").boundingBox(),
    page.getByTestId("analysis-state-actions").boundingBox(),
  ]);
  expect(assetBox, "failure state asset box").toBeTruthy();
  expect(actionsBox, "failure state CTA box").toBeTruthy();
  expect(assetBox!.width).toBeGreaterThanOrEqual(
    testInfo.project.name === "mobile-360" ? 290 : 450,
  );
  expect(assetBox!.y).toBeLessThan(actionsBox!.y);

  // 실패 상태는 exam 라우트의 mist 배경 대신 흰색(container) 배경을 뷰포트 전체에
  // 채운다. 배경색이 흰색인지, 그리고 폭이 콘텐츠 전체(=뷰포트)를 덮는 full-bleed인지
  // 함께 확인한다. (수정 전에는 920px 폭 카드 + 회색 여백이었다.)
  const failedPage = page.getByTestId("analysis-loading-page");
  const pageBg = await failedPage.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(pageBg).toBe("rgb(255, 255, 255)");
  const pageBox = await failedPage.boundingBox();
  expect(pageBox, "failed page box").toBeTruthy();
  expect(pageBox!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);

  await waitForSubmittedRow(answerToken);

  await expect(page.getByRole("button", { name: "고객지원 문의" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "대시보드로 이동" }),
  ).toBeVisible();
});

test("exhausted polling opens the wait modal and the library button routes to the library", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "exhausted wait modal smoke runs on desktop and mobile",
  );

  // Q51 답안 총량 상한(120자)을 넘기지 않도록 토큰/문구를 짧게 유지한다.
  const answerToken = `${RUN_TOKEN}-exh-${testInfo.project.name}-${testInfo.retry}`;
  const answerText = `Exh ${answerToken}.`;

  await page.route(
    "**/api/writing/evaluation-status?submissionId=*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ feedback_status: "analyzing" }),
      });
    },
  );

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await fillShortAnswer51(page, answerText, "Please send the new file.");
  await page.getByRole("button", { name: /제출하기/ }).click();
  await page.getByTestId("submission-confirm-submit").click();

  await expect(page.getByTestId("analysis-state-card")).toBeVisible();

  // 폴링 소진(초기 조회 + 10초 후 재조회)까지 기다리면 즉시 리다이렉트 대신
  // 대기 모달이 열린다. step 아래 인라인 경고는 더 이상 렌더되지 않는다.
  const waitModal = page.getByTestId("analysis-pending-modal");
  await expect(waitModal).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);
  await expect(page.getByTestId("analysis-polling-exhausted")).toHaveCount(0);
  await expect(waitModal.getByText("곧 분석이 완료될 거예요")).toBeVisible();
  await expect(page.getByTestId("analysis-pending-dashboard")).toBeVisible();

  const libraryButton = page.getByTestId("analysis-pending-library");
  await expect(libraryButton).toContainText("내 서재로 이동");

  // 5초 자동 이동 전에 버튼 클릭 경로를 검증한다(자동 이동도 동일하게 /library).
  await libraryButton.click();
  await expect(page).toHaveURL(/\/library/, { timeout: 15_000 });

  await waitForSubmittedRow(answerToken);
});

test("exhausted polling counts down and auto-redirects to the library without a click", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "auto redirect timing smoke runs on desktop only (button path covers mobile)",
  );

  const answerToken = `${RUN_TOKEN}-auto-${testInfo.project.name}-${testInfo.retry}`;
  const answerText = `Auto ${answerToken}.`;

  await page.route(
    "**/api/writing/evaluation-status?submissionId=*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ feedback_status: "analyzing" }),
      });
    },
  );

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await fillShortAnswer51(page, answerText, "Please send the new file.");
  await page.getByRole("button", { name: /제출하기/ }).click();
  await page.getByTestId("submission-confirm-submit").click();

  await expect(page.getByTestId("analysis-state-card")).toBeVisible();
  await expect(page.getByTestId("analysis-pending-modal")).toBeVisible({
    timeout: 15_000,
  });

  // 카운트다운이 실제로 줄어드는지 확인한다(라벨의 숫자가 감소).
  const libraryButton = page.getByTestId("analysis-pending-library");
  const readCountdown = async () =>
    Number(/\((\d)\)/.exec((await libraryButton.textContent()) ?? "")?.[1]);
  const first = await readCountdown();
  expect(first).toBeGreaterThanOrEqual(1);
  await expect
    .poll(readCountdown, { timeout: 4_000 })
    .toBeLessThan(first);

  // 아무것도 클릭하지 않아도 타이머 만료 시 /library로 자동 이동한다.
  await page.waitForURL(/\/library/, { timeout: 10_000 });

  await waitForSubmittedRow(answerToken);
});
