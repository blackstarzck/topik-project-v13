import { expect, test, type Page } from "@playwright/test";

const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051";

const SIDEBAR_CASES = [
  {
    name: "practice problem list",
    route: "/practice/problems",
    pathRegex: /\/practice\/problems/,
    groupKey: "practice",
  },
  {
    name: "writing feedback",
    route: `/writing/feedback/short/${SUB_SHORT}`,
    pathRegex: /\/writing\/feedback\/short\//,
    groupKey: "writing",
  },
] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function openMobileDrawerIfNeeded(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    await page.locator(".app-workspace-mobile-bar button").first().click();
  }
}

for (const sidebarCase of SIDEBAR_CASES) {
  test(`sidebar keeps ${sidebarCase.name} group open on direct entry`, async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto(sidebarCase.route, { waitUntil: "networkidle" });
    await expect(page, "bounced to /login — storageState stale?").not.toHaveURL(
      /\/login/,
    );
    await expect(page).toHaveURL(sidebarCase.pathRegex);

    await openMobileDrawerIfNeeded(page);

    await expect(
      page
        .locator(
          `[data-menu-id="rc-menu-uuid-${sidebarCase.groupKey}"][aria-expanded="true"]:visible`,
        )
        .first(),
    ).toBeVisible();

    expect(errors, errors.join("\n")).toEqual([]);
  });
}
