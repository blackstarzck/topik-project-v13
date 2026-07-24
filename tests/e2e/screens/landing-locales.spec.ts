import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("landing locale contract", () => {
  const locales = [
    {
      locale: "ko",
      coreHeading: "학습 현황부터",
      learnerHeading: "TOPIK 학습자가",
      terms: "이용약관",
    },
    {
      locale: "en",
      coreHeading: "From learning progress",
      learnerHeading: "What TOPIK learners",
      terms: "Terms",
    },
    {
      locale: "vi",
      coreHeading: "Từ tiến độ học tập",
      learnerHeading: "Điều người học TOPIK",
      terms: "Điều khoản",
    },
  ];

  for (const selected of locales) {
    test(`renders the selected ${selected.locale} catalog and opts out of browser translation`, async ({
      page,
      context,
      baseURL,
    }) => {
      const errors = collectPageErrors(page);
      const appUrl = baseURL ?? "http://127.0.0.1:3000";

      await context.addCookies([
        {
          name: "NEXT_LOCALE",
          value: selected.locale,
          url: appUrl,
        },
      ]);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        selected.locale,
      );
      await expect(page.locator("html")).toHaveAttribute("translate", "no");
      await expect(page.locator('meta[name="google"]')).toHaveAttribute(
        "content",
        "notranslate",
      );
      await expect(page.getByText(selected.coreHeading)).toBeVisible();
      await expect(page.getByText(selected.learnerHeading)).toBeVisible();
      await expect(
        page.locator('#contact a[href="/terms"]', {
          hasText: selected.terms,
        }),
      ).toBeVisible();

      if (selected.locale !== "ko") {
        await expect(page.getByText("학습 현황부터")).toHaveCount(0);
      }

      expect(errors).toEqual([]);
    });
  }
});
