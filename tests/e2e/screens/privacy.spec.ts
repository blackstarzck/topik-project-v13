import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

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

test("X-14 privacy page exposes placeholder policy scope and related links", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/privacy", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByTestId("privacy-card")).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();

  const viewport = page.viewportSize();
  const cardBox = await page.getByTestId("privacy-card").boundingBox();
  expect(cardBox).not.toBeNull();
  if (viewport && viewport.width >= 1000) {
    expect(cardBox!.width).toBeGreaterThanOrEqual(958);
    expect(cardBox!.width).toBeLessThanOrEqual(962);
  }

  // The page renders the admin-published document when a published privacy row
  // exists, otherwise the i18n placeholder. Both are valid public-page states.
  const placeholder = page.getByTestId("privacy-intro");
  const documentBody = page.getByTestId("privacy-document-body");
  await expect(placeholder.or(documentBody)).toBeVisible();

  if (await placeholder.isVisible()) {
    await expect(page.getByTestId("privacy-summary")).toBeVisible();
    await expect(page.getByTestId("privacy-update")).toBeVisible();
    await expect(page.getByTestId("privacy-related-links")).toBeVisible();
    await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/sign-up"]').first()).toBeVisible();
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  } else {
    await expect(documentBody).toBeVisible();
    const text = await documentBody.innerText();
    expect(text).not.toContain("<div>");
    expect(text).not.toContain("<br>");
    expect(text).not.toMatch(/(^|\n)\s*#{1,6}\s/);
    expect(text).not.toContain("&nbsp;");
    expect(text).not.toContain("&gt;");
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("&amp;");
  }

  expect(errors).toEqual([]);
});
