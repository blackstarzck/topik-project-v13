import { expect, test } from "@playwright/test";

test("landing header brand logo loads eagerly", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.locator(".landing-header-logo img")).toHaveAttribute(
    "loading",
    "eager",
  );
});

test("auth prompt brand logos load eagerly", async ({ baseURL, browser }) => {
  const origin = baseURL ?? "http://127.0.0.1:3000";
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  try {
    await page.goto(new URL("/login", origin).toString(), {
      waitUntil: "networkidle",
    });

    const logos = page.locator(
      ".signup-brand img, .signup-prompt-mobile-brand img",
    );
    await expect(logos).toHaveCount(2);
    await expect(logos.first()).toHaveAttribute("loading", "eager");
    await expect(logos.nth(1)).toHaveAttribute("loading", "eager");
  } finally {
    await context.close();
  }
});

test("workspace above-fold brand logo loads eagerly", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(
    page,
    "authenticated storageState should reach workspace",
  ).not.toHaveURL(/\/login/);

  const viewport = page.viewportSize();
  const selector =
    viewport && viewport.width < 768
      ? ".app-workspace-mobile-brand img"
      : ".app-sidebar-brand img";

  await expect(page.locator(selector)).toHaveAttribute("loading", "eager");
});
