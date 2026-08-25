import { expect, test, type Page } from "@playwright/test";

const PHONE_REMINDER_TITLE = "전화번호를 등록해 주세요";

const SIDEBAR_CASES = [
  {
    name: "practice problem list",
    route: "/practice/problems",
    pathRegex: /\/practice\/problems/,
    groupKey: "practice",
  },
  {
    name: "weakness recommendations",
    route: "/practice/weakness",
    pathRegex: /\/practice\/weakness/,
    groupKey: "growth",
  },
  {
    name: "profile editing",
    route: "/profile",
    pathRegex: /\/profile/,
    groupKey: "settings",
  },
  {
    name: "account settings",
    route: "/settings/account",
    pathRegex: /\/settings\/account/,
    groupKey: "settings",
  },
  {
    name: "learning settings",
    route: "/settings/learning",
    pathRegex: /\/settings\/learning/,
    groupKey: "settings",
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

async function closeSessionOnlyReminder(page: Page) {
  const reminderDialog = page.getByRole("dialog", {
    name: PHONE_REMINDER_TITLE,
    exact: true,
  });
  if (await reminderDialog.isVisible().catch(() => false)) {
    await reminderDialog.locator(".ant-modal-close").click();
    await expect(reminderDialog).toBeHidden();
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

test("sidebar keeps an 8px visual gap between Iconsax icons and labels", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page, "bounced to /login ??storageState stale?").not.toHaveURL(
    /\/login/,
  );
  await closeSessionOnlyReminder(page);

  await openMobileDrawerIfNeeded(page);

  const sidebarMenu = page
    .locator(".app-sidebar-menu:not(.ant-menu-inline-collapsed)")
    .first();
  const growthTitle = sidebarMenu.locator(".ant-menu-submenu-title", {
    hasText: "성장 리포트",
  });

  await expect(
    growthTitle.locator('[data-sidebar-icon-name="DocumentText"]'),
  ).toBeVisible();

  await growthTitle.click();
  await expect(
    sidebarMenu
      .locator(".ant-menu-item", { hasText: "성장 대시보드" })
      .locator('[data-sidebar-icon-name="Chart2"]'),
  ).toBeVisible();

  const measurements = await page
    .locator(".app-sidebar-menu:not(.ant-menu-inline-collapsed)")
    .first()
    .evaluate((menu) => {
      const items = Array.from(
        menu.querySelectorAll(".ant-menu-item, .ant-menu-submenu-title"),
      ).filter((item) => {
        return item.getClientRects().length > 0;
      });

      return items.map((item) => {
        const icon = item.querySelector(".app-sidebar-icon");
        const title = item.querySelector(".ant-menu-title-content");
        const iconRect = icon?.getBoundingClientRect();
        const titleRect = title?.getBoundingClientRect();

        return {
          text: title?.textContent?.trim() ?? "",
          gap:
            iconRect && titleRect
              ? Math.round((titleRect.left - iconRect.right) * 100) / 100
              : null,
        };
      });
    });

  expect(measurements.length).toBeGreaterThan(0);
  for (const measurement of measurements) {
    expect(measurement.gap, measurement.text).toBeGreaterThanOrEqual(7.5);
    expect(measurement.gap, measurement.text).toBeLessThanOrEqual(8.5);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
