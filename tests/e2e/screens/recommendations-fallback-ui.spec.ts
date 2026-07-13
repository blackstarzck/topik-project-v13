import { expect, test, type Page, type Route } from "@playwright/test";

// C-01 problem-type recommendations — COMPUTED (rule-based fallback) UI states.
//
// The bundle is assembled server-side (stored recommendation_items first, else
// a transient rule-based computation from the user's history — implementation
// brief: docs/sot-change-proposals/2026-07-09-c01-rule-fallback-recommendations-
// implementation-brief.md). These specs pin the UI contract for a computed
// bundle by stubbing the API route: success (hero + reason panel + honest
// tags), loading (skeletons), and error (alert + retry recovers). The rule
// logic itself is covered by tests/lib/practice/recommendation-fallback.test.ts;
// the live end-to-end path is covered by recommendations-fallback-live.spec.ts.

const STRINGS = {
  heading: "추천 문제",
  reasonSummaryTitle: "이렇게 추천했어요",
  rotationSummary: "아직 풀이 기록이 적어 51→54 유형 순환 순서로 골랐어요.",
  primaryBadge: "대표 추천",
  rotationReason: "아직 덜 연습한 유형이라 다음 순서로 추천해요.",
  unattemptedReason: "아직 풀지 않은 공개 문제예요.",
  grammarDimensionLabel: "문법",
  fabricatedTag: "구성 흐름 강화",
  otherRecommendations: "다른 추천",
  continueProblem: "이어 풀기",
  loadErrorTitle: "추천을 불러오지 못했어요",
  retry: "다시 시도",
  primaryTitle: "51번 규칙 추천 검증 문제",
  secondaryTitle: "52번 규칙 추천 검증 문제",
} as const;

const COMPUTED_BUNDLE = {
  run: null,
  source: "computed",
  summaryCode: "rotation",
  availableTypes: [51, 52],
  items: [
    {
      itemId: null,
      problemId: "3c1f5a00-0000-4000-8000-00000000e251",
      rank: 1,
      reason: null,
      reasonCode: "TYPE_ROTATION_NEXT",
      estimatedMinutes: null,
      weaknessTags: ["grammar"],
      title: STRINGS.primaryTitle,
      questionNo: 51,
    },
    {
      itemId: null,
      problemId: "3c1f5a00-0000-4000-8000-00000000e252",
      rank: 2,
      reason: null,
      reasonCode: "UNATTEMPTED_AVAILABLE",
      estimatedMinutes: null,
      weaknessTags: [],
      title: STRINGS.secondaryTitle,
      questionNo: 52,
    },
  ],
} as const;

function fulfillBundle(route: Route, body: unknown = COMPUTED_BUNDLE) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function quietNotifications(page: Page) {
  await page.route("**/rest/v1/user_notifications?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

test("C-01 computed bundle renders an honest rule-based recommendation", async ({
  page,
}) => {
  await quietNotifications(page);
  await page.route("**/api/practice/recommendations*", (route) =>
    fulfillBundle(route),
  );
  const errors = collectErrors(page);

  await page.goto("/practice/recommendations", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/practice\/recommendations/);
  await expect(
    page.getByRole("heading", { name: STRINGS.heading }),
  ).toBeVisible();

  // Reason panel: honest rotation summary + REAL weakness tag as a locale
  // label ("문법"), never the removed fabricated defaults and never the raw
  // dimension key.
  await expect(page.getByText(STRINGS.reasonSummaryTitle)).toBeVisible();
  await expect(page.getByText(STRINGS.rotationSummary)).toBeVisible();
  await expect(
    page.getByText(STRINGS.grammarDimensionLabel, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(STRINGS.fabricatedTag)).toHaveCount(0);
  await expect(page.getByText("grammar", { exact: true })).toHaveCount(0);

  // Hero: primary badge + real problem title + rule-based reason copy.
  await expect(page.getByText(STRINGS.primaryBadge)).toBeVisible();
  await expect(page.getByText(STRINGS.primaryTitle)).toBeVisible();
  await expect(page.getByText(STRINGS.rotationReason)).toBeVisible();

  // Secondary grid with its own rule-based reason.
  await expect(page.getByText(STRINGS.otherRecommendations)).toBeVisible();
  await expect(page.getByText(STRINGS.secondaryTitle)).toBeVisible();
  await expect(page.getByText(STRINGS.unattemptedReason)).toBeVisible();
  await expect(
    page.getByRole("link", { name: STRINGS.continueProblem }),
  ).toBeVisible();

  // Both cards link into the writing workspace with their problem ids.
  await expect(
    page.locator(`a[href*="problem=${COMPUTED_BUNDLE.items[0].problemId}"]`),
  ).toBeVisible();
  const writingLinkCount = await page.locator('a[href^="/writing/"]').count();
  expect(writingLinkCount).toBeGreaterThanOrEqual(2);

  // No page/console errors (guards e.g. the null-itemId React key regression).
  expect(errors).toEqual([]);
});

test("C-01 shows loading skeletons while the computed bundle is in flight", async ({
  page,
}) => {
  await quietNotifications(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/practice/recommendations*", async (route) => {
    await gate;
    await fulfillBundle(route);
  });

  await page.goto("/practice/recommendations", {
    waitUntil: "domcontentloaded",
  });

  // While the request is held open both skeletons must be visible and no
  // fabricated content may leak in.
  await expect(
    page.getByTestId("recommendation-reason-skeleton"),
  ).toBeVisible();
  await expect(
    page.getByTestId("recommendation-results-skeleton"),
  ).toBeVisible();
  await expect(page.getByText(STRINGS.primaryBadge)).toHaveCount(0);

  release?.();

  await expect(page.getByText(STRINGS.primaryBadge)).toBeVisible();
  await expect(page.getByTestId("recommendation-results-skeleton")).toHaveCount(
    0,
  );
});

test("C-01 surfaces the error state on a 500 and recovers via retry", async ({
  page,
}) => {
  await quietNotifications(page);
  let requestCount = 0;
  await page.route("**/api/practice/recommendations*", (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "server_error" }),
      });
    }
    return fulfillBundle(route);
  });

  await page.goto("/practice/recommendations", { waitUntil: "networkidle" });

  await expect(page.getByText(STRINGS.loadErrorTitle)).toBeVisible();
  await expect(page.getByText(STRINGS.primaryBadge)).toHaveCount(0);

  await page.getByRole("button", { name: STRINGS.retry }).click();

  await expect(page.getByText(STRINGS.primaryBadge)).toBeVisible();
  await expect(page.getByText(STRINGS.primaryTitle)).toBeVisible();
  expect(requestCount).toBeGreaterThanOrEqual(2);
});
