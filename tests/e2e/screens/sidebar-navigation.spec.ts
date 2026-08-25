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

test("sidebar brand keeps 68px geometry and keyboard navigation", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const isMobile =
    (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768;

  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page, "bounced to /login — storageState stale?").not.toHaveURL(
    /\/login/,
  );
  await expect(page).toHaveURL(/\/library(?:[/?#]|$)/);
  await closeSessionOnlyReminder(page);

  const menuDialog = page.locator('.app-workspace-drawer [role="dialog"]');
  if (isMobile) {
    const menuButton = page.locator(".app-workspace-mobile-bar button").first();

    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await menuButton.press("Enter");
    await expect(menuDialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menuDialog).toBeHidden();
    await expect(menuButton).toBeFocused();

    await menuButton.press("Enter");
    await expect(menuDialog).toBeVisible();
  }

  const visibleSidebarShell = page
    .locator(".app-sidebar-shell:visible")
    .first();
  const visibleMenuScroll = visibleSidebarShell.locator(
    ".app-sidebar-menu-scroll",
  );
  await expect(visibleSidebarShell).toBeVisible();
  await expect(visibleMenuScroll).toBeVisible();

  const sidebarLayout = await visibleSidebarShell.evaluate((shell) => {
    const menuScroll = shell.querySelector<HTMLElement>(
      ".app-sidebar-menu-scroll",
    );
    if (!menuScroll) return null;

    const shellStyle = window.getComputedStyle(shell);
    const menuScrollStyle = window.getComputedStyle(menuScroll);
    return {
      shellDisplay: shellStyle.display,
      shellFlexDirection: shellStyle.flexDirection,
      shellOverflow: shellStyle.overflow,
      shellPaddingTop: shellStyle.paddingTop,
      shellPaddingBottom: shellStyle.paddingBottom,
      menuFlex: menuScrollStyle.flex,
      menuMinHeight: menuScrollStyle.minHeight,
      menuOverflowX: menuScrollStyle.overflowX,
      menuOverflowY: menuScrollStyle.overflowY,
    };
  });
  expect(sidebarLayout).not.toBeNull();
  if (!sidebarLayout) {
    throw new Error("Visible sidebar layout was not measurable");
  }
  expect(sidebarLayout.shellDisplay).toBe("flex");
  expect(sidebarLayout.shellFlexDirection).toBe("column");
  expect(sidebarLayout.shellOverflow).toBe("hidden");
  expect(sidebarLayout.shellPaddingTop).toBe("18px");
  expect(sidebarLayout.shellPaddingBottom).toBe("18px");
  expect(sidebarLayout.menuFlex).toBe("1 1 auto");
  expect(sidebarLayout.menuMinHeight).toBe("0px");
  expect(sidebarLayout.menuOverflowX).toBe("hidden");
  expect(sidebarLayout.menuOverflowY).toBe("auto");
  if (isMobile) {
    const overflowMetrics = await visibleMenuScroll.evaluate((menuScroll) => {
      menuScroll.style.height = "200px";
      menuScroll.style.flex = "0 0 200px";

      return {
        clientHeight: menuScroll.clientHeight,
        scrollHeight: menuScroll.scrollHeight,
      };
    });
    expect(overflowMetrics.scrollHeight).toBeGreaterThan(
      overflowMetrics.clientHeight,
    );
    await visibleMenuScroll.evaluate((menuScroll) => {
      menuScroll.scrollTop = 40;
    });
    await expect
      .poll(() =>
        visibleMenuScroll.evaluate((menuScroll) => menuScroll.scrollTop),
      )
      .toBeGreaterThan(0);
    await visibleMenuScroll.evaluate((menuScroll) => {
      menuScroll.scrollTop = 0;
      menuScroll.style.removeProperty("height");
      menuScroll.style.removeProperty("flex");
    });
  }

  const brandButton = page.locator(".app-sidebar-brand:visible").first();
  const brandImage = brandButton.locator("img");
  await expect(brandButton).toBeVisible();
  await expect(brandImage).toBeVisible();

  const brandGeometry = await brandButton.evaluate((button) => {
    const image = button.querySelector("img");
    if (!image) return null;

    const buttonRect = button.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    return {
      buttonHeight: buttonRect.height,
      imageHeight: imageRect.height,
      horizontalCenterDifference: Math.abs(
        buttonRect.left +
          buttonRect.width / 2 -
          (imageRect.left + imageRect.width / 2),
      ),
    };
  });
  expect(brandGeometry).not.toBeNull();
  if (!brandGeometry) {
    throw new Error("Visible sidebar brand geometry was not measurable");
  }

  expect(brandGeometry.buttonHeight).toBe(68);
  expect(brandGeometry.imageHeight).toBe(68);
  expect(brandGeometry.horizontalCenterDifference).toBeLessThanOrEqual(0.5);

  await brandButton.focus();
  await expect(brandButton).toBeFocused();
  await brandButton.press("Enter");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
  await expect(
    page.getByRole("heading", { name: "오늘의 학습", exact: true }),
  ).toBeVisible();
  if (isMobile) {
    await expect(menuDialog).toBeHidden();
  }

  const horizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return (
      Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth
    );
  });
  expect(horizontalOverflow).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("focus route omits workspace navigation chrome without browser data writes", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const restWrites: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/rest/v1/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
    ) {
      restWrites.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/practice/next", { waitUntil: "networkidle" });
  await expect(page, "bounced to /login — storageState stale?").not.toHaveURL(
    /\/login/,
  );
  await expect(page.getByTestId("workspace-page-body")).toBeVisible();

  const workspaceLayout = page.locator(".app-workspace-layout");
  await expect(workspaceLayout).not.toHaveClass(/ant-layout-has-sider/);
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(page.locator(".app-workspace-mobile-bar")).toHaveCount(0);
  await expect(page.locator(".app-workspace-drawer")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);

  expect(restWrites).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
});
