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

test("X-13 terms page renders legal content with escape links", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/terms", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/terms/);
  await expect(page.getByTestId("terms-card")).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();

  // The page renders the admin-published document (TermsDocument) when a
  // published legal_documents row exists, otherwise the i18n placeholder
  // (TermsContent). Both are valid; assert whichever branch is live.
  const placeholder = page.getByTestId("terms-intro");
  const documentBody = page.getByTestId("terms-document-body");
  await expect(placeholder.or(documentBody)).toBeVisible();

  if (await placeholder.isVisible()) {
    const viewport = page.viewportSize();
    const cardBox = await page.getByTestId("terms-card").boundingBox();
    expect(cardBox).not.toBeNull();
    if (viewport && viewport.width >= 1000) {
      expect(cardBox!.width).toBeGreaterThanOrEqual(958);
      expect(cardBox!.width).toBeLessThanOrEqual(962);
      expect(cardBox!.height).toBeGreaterThan(viewport.height - 96);
    }
    await expect(page.getByTestId("terms-placeholder-notice")).toBeVisible();
    await expect(page.getByTestId("terms-summary")).toBeVisible();
    await expect(page.getByTestId("terms-contact")).toBeVisible();
    await expect(page.getByTestId("terms-shortcuts")).toBeVisible();
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(page.locator('a[href="/sign-up"]').first()).toBeVisible();
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  } else {
    await expect(documentBody).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test("X-13 published terms body renders without raw markup literals", async ({
  page,
}) => {
  await page.goto("/terms", { waitUntil: "networkidle" });

  const body = page.getByTestId("terms-document-body");
  // The rendered branch depends on whether this Supabase project has a published
  // legal_documents row. When only the i18n placeholder shows, the definitive
  // check lives in the unit tests (tests/lib/legal/html.test.ts).
  test.skip(
    (await body.count()) === 0,
    "No published terms document in this environment — placeholder branch active",
  );

  const text = await body.innerText();
  expect(text).not.toContain("<div>");
  expect(text).not.toContain("<br>");
  expect(text).not.toMatch(/(^|\n)\s*#{1,6}\s/);
  // Double-escaped entities (&amp;nbsp;) surface to the reader as literal
  // "&nbsp;" / "&gt;" text; innerText decodes one level, so a leftover entity
  // string here means the body was escaped twice.
  expect(text).not.toContain("&nbsp;");
  expect(text).not.toContain("&gt;");
  expect(text).not.toContain("&lt;");
  expect(text).not.toContain("&amp;");
});
