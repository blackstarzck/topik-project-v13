import { expect, test, type Page } from "@playwright/test";

// C-01 problem-type recommendations — EMPTY STATE regression.
//
// Context: after the dev DB was fully wiped, the recommendations page still
// *looked* populated — a "대표 추천" hero and an "이렇게 추천했어요" analysis panel
// rendered from hardcoded i18n fallbacks, reading like real personalized data.
// That was an honesty bug in the empty state, NOT leaked seed/mock data (the
// page has always queried Supabase live).
//
// This test forces the live recommendation queries to return zero rows and
// asserts the empty state is honest: no fabricated hero, no fabricated reason
// analysis — just a plain "nothing to recommend yet" message plus the static
// type-select cards as the way to start practicing.

const STRINGS = {
  heading: "추천 문제",
  reasonSummaryTitle: "이렇게 추천했어요",
  primaryBadge: "대표 추천",
  fallbackHeroTitle51: "51번 단답 추천 유형",
  emptyDescription:
    "아직 추천할 문제가 없어요. 아래에서 유형을 직접 골라 시작해 보세요.",
  viewProblemList: "문제 목록 보기",
  typeSelectTitle: "유형을 직접 골라 시작하기",
} as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

test("C-01 recommendations renders an honest empty state when there are zero recommendations", async ({
  page,
}) => {
  // Force the live recommendation tables to look empty, independent of DB seed
  // state. A 200 means no query error is thrown; zero rows means items.length 0
  // → the empty branch renders.
  for (const table of ["recommendation_runs", "recommendation_items"]) {
    await page.route(`**/rest/v1/${table}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      }),
    );
  }
  // Keep the workspace shell's notification bell quiet so it can't add noise.
  await page.route("**/rest/v1/user_notifications?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  const errors = collectErrors(page);

  await page.goto("/practice/recommendations", { waitUntil: "networkidle" });

  // Auth held and we are on the intended route.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/practice\/recommendations/);

  // Page rendered (hydration).
  await expect(
    page.getByRole("heading", { name: STRINGS.heading }),
  ).toBeVisible();

  // The honest empty message is shown.
  await expect(page.getByText(STRINGS.emptyDescription)).toBeVisible();

  // No fabricated personalized recommendation content.
  await expect(page.getByText(STRINGS.primaryBadge)).toHaveCount(0);
  await expect(page.getByText(STRINGS.reasonSummaryTitle)).toHaveCount(0);
  await expect(page.getByText(STRINGS.fallbackHeroTitle51)).toHaveCount(0);

  // The type-select cards remain as the way to start practicing.
  await expect(page.getByText(STRINGS.typeSelectTitle)).toBeVisible();

  // "문제 목록 보기" is an emphasized primary button that links to the list.
  const problemListButton = page.getByRole("button", {
    name: STRINGS.viewProblemList,
  });
  await expect(problemListButton).toBeVisible();
  await expect(problemListButton).toHaveClass(/ant-btn-primary/);
  // It is wrapped in an anchor to the problem list. Scope by the button it
  // contains so this does not collide with the sidebar's "문제 목록" nav link,
  // which points at the same href.
  const ctaLink = page.locator('a[href="/practice/problems"]', {
    has: problemListButton,
  });
  await expect(ctaLink).toBeVisible();

  expect(errors).toEqual([]);
});
