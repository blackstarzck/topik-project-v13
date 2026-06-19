import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

function shouldRunGuardProject(projectName: string): boolean {
  return projectName === "desktop-1280" || projectName === "mobile-360";
}

test("writing 51 header back only warns after answer data changes", async ({
  page,
}, testInfo) => {
  test.skip(
    !shouldRunGuardProject(testInfo.project.name),
    "exit guard flow runs on desktop and mobile",
  );
  const errors = collectErrors(page);

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  const backButton = page.locator(".writing-exam-header__back");
  await backButton.click();
  await expect(page).toHaveURL(/\/practice\/problems/);

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await page
    .locator("textarea")
    .first()
    .fill(`exit guard draft ${Date.now()} with enough length`);

  await backButton.click();
  const modal = page.getByTestId("autosave-warning-modal");
  await expect(modal).toBeVisible();

  await page.getByTestId("autosave-warning-keep").click();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);

  await backButton.click();
  await expect(modal).toBeVisible();
  await page.getByTestId("autosave-warning-proceed").click();
  await expect(page).toHaveURL(/\/practice\/problems/);

  expect(errors).toEqual([]);
});

test("writing 51 browser back is held on dirty answers", async ({
  page,
}, testInfo) => {
  test.skip(
    !shouldRunGuardProject(testInfo.project.name),
    "exit guard flow runs on desktop and mobile",
  );
  const errors = collectErrors(page);

  await page.goto("/practice/problems", { waitUntil: "networkidle" });
  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await page
    .locator("textarea")
    .first()
    .fill(`browser back guard ${Date.now()} with enough length`);

  await page.evaluate(() => window.history.back());

  const modal = page.getByTestId("autosave-warning-modal");
  await expect(modal).toBeVisible();
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);

  await page.getByTestId("autosave-warning-keep").click();
  await expect(modal).toBeHidden();

  expect(errors).toEqual([]);
});
