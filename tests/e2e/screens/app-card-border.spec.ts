import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test("B-01 dashboard AppCard borders use the light Fog outline", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/dashboard/);

  const firstCard = page
    .locator(".app-cards-bordered .app-card.app-surface")
    .first();
  await expect(firstCard).toBeVisible();

  const colors = await firstCard.evaluate((card) => {
    const normalizeColor = (value: string) => {
      const probe = document.createElement("span");
      probe.style.color = value.trim();
      document.body.appendChild(probe);
      const normalized = window.getComputedStyle(probe).color;
      probe.remove();
      return normalized;
    };

    const toRgbString = (value: string) => {
      const parseRgb = (candidate: string) => {
        const rgbMatch = candidate.match(
          /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/,
        );
        if (rgbMatch) {
          return `rgb(${Math.round(Number(rgbMatch[1]))}, ${Math.round(
            Number(rgbMatch[2]),
          )}, ${Math.round(Number(rgbMatch[3]))})`;
        }

        const srgbMatch = candidate.match(
          /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/,
        );
        if (srgbMatch) {
          return `rgb(${Math.round(Number(srgbMatch[1]) * 255)}, ${Math.round(
            Number(srgbMatch[2]) * 255,
          )}, ${Math.round(Number(srgbMatch[3]) * 255)})`;
        }

        return null;
      };

      const normalized = normalizeColor(value);
      return parseRgb(normalized) ?? parseRgb(value.trim()) ?? normalized;
    };

    const rootStyle = window.getComputedStyle(document.documentElement);
    const appBorder = rootStyle.getPropertyValue("--app-color-border");
    const antSecondary = rootStyle.getPropertyValue(
      "--ant-color-border-secondary",
    );
    const cardStyle = window.getComputedStyle(card);

    return {
      antSecondaryBorder: toRgbString(antSecondary),
      appBorder: toRgbString(appBorder),
      cardBorder: toRgbString(cardStyle.borderTopColor),
      expectedCardBorder: toRgbString("#ececee"),
    };
  });

  expect(colors.appBorder).toBe("rgb(212, 212, 216)");
  expect(colors.cardBorder).toBe(colors.expectedCardBorder);
  expect(colors.cardBorder).not.toBe(colors.appBorder);
  expect(colors.cardBorder).not.toBe(colors.antSecondaryBorder);
  expect(errors, `uncaught page errors:\n${errors.join("\n")}`).toEqual([]);
});
