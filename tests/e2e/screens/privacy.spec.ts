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

test("X-14 privacy page shows only an official document or a broad unavailable state", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/privacy", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  const documentBody = page.getByTestId("privacy-document-body");
  const unavailable = page.getByTestId("unavailable-state");
  await expect(documentBody.or(unavailable)).toBeVisible();

  // Temporary policy copy must never be presented as the official document.
  await expect(page.getByTestId("privacy-intro")).toHaveCount(0);
  await expect(page.getByTestId("privacy-summary")).toHaveCount(0);

  if (await unavailable.isVisible()) {
    await expect(
      unavailable.getByText(
        /필수 정보를 불러오지 못했습니다|could not load the required information/i,
      ),
    ).toBeVisible();
    await expect(unavailable.locator('a[href="/privacy"]')).toHaveCount(1);
    await expect(unavailable.locator('a[href="/"]')).toHaveCount(1);
    await expect(unavailable).not.toContainText(
      /postgres|supabase|token|stack|validation_failed/i,
    );
  } else {
    await expect(page.getByTestId("privacy-card")).toBeVisible();
    const viewport = page.viewportSize();
    const cardBox = await page.getByTestId("privacy-card").boundingBox();
    expect(cardBox).not.toBeNull();
    if (viewport && viewport.width >= 1000) {
      expect(cardBox!.width).toBeGreaterThanOrEqual(958);
      expect(cardBox!.width).toBeLessThanOrEqual(962);
    }

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
