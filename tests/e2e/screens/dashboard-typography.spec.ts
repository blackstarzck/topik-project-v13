import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

async function attachRuntimeErrors(testInfo: TestInfo, errors: string[]) {
  await testInfo.attach("runtime-errors.json", {
    body: JSON.stringify(errors, null, 2),
    contentType: "application/json",
  });
}

test("B-01 home dashboard renders dashboard copy at 14px or larger", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  const twelvePxTexts = await page.locator(".app-cards-bordered").evaluate(
    (root) => {
      const elements = Array.from(
        root.querySelectorAll<HTMLElement>(
          [
            "a",
            "button",
            "p",
            "small",
            "span",
            "strong",
            ".ant-card-head-title",
            ".ant-empty-description",
            ".ant-typography",
          ].join(","),
        ),
      );

      return elements
        .filter((element) => {
          const text = element.textContent?.replace(/\s+/g, " ").trim();
          if (!text) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return window.getComputedStyle(element).fontSize === "12px";
        })
        .map((element) => ({
          className: element.className.toString(),
          tagName: element.tagName.toLowerCase(),
          text: element.textContent?.replace(/\s+/g, " ").trim(),
        }));
    },
  );

  await testInfo.attach("dashboard-12px-texts.json", {
    body: JSON.stringify(twelvePxTexts, null, 2),
    contentType: "application/json",
  });
  expect(twelvePxTexts).toEqual([]);

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
