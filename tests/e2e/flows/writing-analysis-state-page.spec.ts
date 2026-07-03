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
