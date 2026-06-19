import { test, expect, type Page } from "@playwright/test";

// Tier 2 — per-screen validation for PUBLIC (unauthenticated) screens.
// Runs in all three viewport projects (360/768/1280) for responsive coverage.
// storageState is cleared so authed-redirect middleware does not bounce these.
//
// Each screen asserts: intended URL (no unexpected redirect), hydration (a heading
// renders), and ZERO uncaught page errors. A page-level hydration error therefore
// fails the screen — this is intentional (it surfaces real bugs, e.g. X-16).
test.use({ storageState: { cookies: [], origins: [] } });

type Screen = {
  ia: string;
  name: string;
  route: string;
  urlRegex?: RegExp; // expected final path; omit for lenient (transient) screens
  lenientHeading?: boolean; // some fallback pages have no heading
};

const PUBLIC_SCREENS: Screen[] = [
  { ia: "X-01", name: "product-landing", route: "/", urlRegex: /\/$/ },
  { ia: "X-13", name: "terms", route: "/terms", urlRegex: /\/terms/ },
  { ia: "X-14", name: "privacy", route: "/privacy", urlRegex: /\/privacy/ },
  { ia: "A-01", name: "sign-up", route: "/sign-up", urlRegex: /\/sign-up/ },
  { ia: "A-02", name: "login", route: "/login", urlRegex: /\/login/ },
  {
    ia: "A-02",
    name: "login-session-expired",
    route: "/login?reason=session_expired",
    urlRegex: /\/login/,
  },
  {
    ia: "X-06",
    name: "password-reset",
    route: "/password-reset",
    urlRegex: /\/password-reset/,
  },
  {
    ia: "X-16",
    name: "password-reset-confirm",
    route: "/password-reset/confirm",
    urlRegex: /\/password-reset\/confirm/,
  },
  {
    ia: "X-11",
    name: "auth-error-otp",
    route: "/auth/error?reason=otp_expired",
    urlRegex: /\/auth\/error/,
  },
  {
    ia: "X-11",
    name: "auth-error-ratelimit",
    route: "/auth/error?reason=over_request_rate_limit",
    urlRegex: /\/auth\/error/,
  },
  {
    ia: "X-12",
    name: "auth-verify-email",
    route: "/auth/verify-email",
    urlRegex: /\/auth\/verify-email/,
  },
  // X-17 is a transient fragment-handling fallback — it may redirect; assert no crash only.
  {
    ia: "X-17",
    name: "auth-callback-fragment",
    route: "/auth/callback-fragment",
    lenientHeading: true,
  },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

for (const s of PUBLIC_SCREENS) {
  test(`${s.ia} ${s.name} renders without page errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(s.route, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    if (s.urlRegex) await expect(page).toHaveURL(s.urlRegex);

    if (!s.lenientHeading) {
      await expect(page.getByRole("heading").first()).toBeVisible();
    }

    if (s.name === "product-landing") {
      const heroVideo = page.locator("video.landing-hero-video");
      await expect(heroVideo).toBeVisible();
      await expect(heroVideo.locator("source")).toHaveAttribute(
        "src",
        "/assets/landing-hero-video.mp4",
      );
      await expect
        .poll(() =>
          heroVideo.evaluate((node) => (node as HTMLVideoElement).readyState),
        )
        .toBeGreaterThanOrEqual(2);
      await expect
        .poll(() =>
          heroVideo.evaluate((node) => (node as HTMLVideoElement).videoWidth),
        )
        .toBeGreaterThan(0);
      await expect(heroVideo).toHaveJSProperty("muted", true);
      await expect(heroVideo).toHaveJSProperty("loop", true);
      await expect(heroVideo).toHaveJSProperty("playsInline", true);

      const landingTypeMetrics = await page.evaluate(() => {
        const readPx = (value: string) => Number.parseFloat(value);
        const hero = document.querySelector<HTMLElement>(".landing-hero");
        const layoutRoot = document.querySelector<HTMLElement>(
          ".landing-layout-motion-root",
        );
        const heroTitle = document.querySelector<HTMLElement>(
          ".landing-hero-title",
        );
        const heroBody =
          document.querySelector<HTMLElement>(".landing-hero-body");
        const heroButton = document.querySelector<HTMLElement>(
          ".landing-hero-button",
        );
        const heroButtonIcon = heroButton?.querySelector<SVGElement>("svg");

        if (!hero || !layoutRoot || !heroTitle || !heroBody || !heroButton) {
          throw new Error("landing typography targets are missing");
        }

        const titleStyles = window.getComputedStyle(heroTitle);
        const titleFontSize = readPx(titleStyles.fontSize);
        const titleLineHeight = readPx(titleStyles.lineHeight);

        return {
          heroBodyFontSize: readPx(window.getComputedStyle(heroBody).fontSize),
          heroButtonFontSize: readPx(
            window.getComputedStyle(heroButton).fontSize,
          ),
          heroButtonIconHeight:
            heroButtonIcon?.getBoundingClientRect().height ?? 0,
          heroButtonIconStrokeWidth:
            heroButtonIcon?.getAttribute("stroke-width") ?? "",
          heroButtonIconWidth:
            heroButtonIcon?.getBoundingClientRect().width ?? 0,
          heroFontSize: readPx(window.getComputedStyle(hero).fontSize),
          layoutRootFontSize: readPx(
            window.getComputedStyle(layoutRoot).fontSize,
          ),
          titleLineHeightRatio: Number(
            (titleLineHeight / titleFontSize).toFixed(2),
          ),
        };
      });
      expect(landingTypeMetrics.heroFontSize).toBe(16);
      expect(landingTypeMetrics.layoutRootFontSize).toBe(16);
      expect(landingTypeMetrics.heroBodyFontSize).toBe(16);
      expect(landingTypeMetrics.titleLineHeightRatio).toBe(1.2);
      expect(landingTypeMetrics.heroButtonFontSize).toBe(16);
      expect(landingTypeMetrics.heroButtonIconWidth).toBe(18);
      expect(landingTypeMetrics.heroButtonIconHeight).toBe(18);
      expect(landingTypeMetrics.heroButtonIconStrokeWidth).toBe("2.25");

      const landingHeader = page.locator(".landing-header");
      await expect(landingHeader).toBeVisible();
      const headerMetrics = await landingHeader.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const styles = window.getComputedStyle(node);
        const beforeStyles = window.getComputedStyle(node, "::before");
        const afterStyles = window.getComputedStyle(node, "::after");
        const elementAtHeader = document.elementFromPoint(
          Math.floor(window.innerWidth / 2),
          Math.min(34, Math.floor(rect.height / 2)),
        );
        return {
          background: styles.backgroundColor,
          backdropFilter: styles.backdropFilter,
          borderBottomWidth: styles.borderBottomWidth,
          boxShadow: styles.boxShadow,
          beforeDisplay: beforeStyles.display,
          afterDisplay: afterStyles.display,
          documentClientWidth: document.documentElement.clientWidth,
          elementAtHeaderInsideHeader: Boolean(
            elementAtHeader?.closest(".landing-header"),
          ),
          height: rect.height,
          left: rect.left,
          maxWidth: styles.maxWidth,
          position: styles.position,
          right: rect.right,
          top: rect.top,
          transform: styles.transform,
          width: rect.width,
          zIndex: styles.zIndex,
        };
      });
      const headerBlurMatch =
        headerMetrics.backdropFilter.match(/blur\(([\d.]+)px\)/);
      expect(
        headerBlurMatch,
        `expected landing header backdrop blur, got ${headerMetrics.backdropFilter}`,
      ).not.toBeNull();
      const headerBlurPx = Number(headerBlurMatch?.[1] ?? 0);
      expect(headerBlurPx).toBeGreaterThan(0);
      expect(headerBlurPx).toBeLessThanOrEqual(17);
      expect(headerMetrics.background).toBe("rgba(255, 255, 255, 0.72)");
      const hasVisibleHeaderShadow =
        headerMetrics.boxShadow !== "none" &&
        !headerMetrics.boxShadow
          .split(/,\s(?=rgba?\()/)
          .every((layer) =>
            layer.startsWith("rgba(0, 0, 0, 0) 0px 0px 0px 0px"),
          );
      expect(hasVisibleHeaderShadow).toBe(false);
      expect(headerMetrics.borderBottomWidth).toBe("0px");
      expect(headerMetrics.beforeDisplay).toBe("none");
      expect(headerMetrics.afterDisplay).toBe("none");
      expect(Number(headerMetrics.zIndex)).toBeGreaterThanOrEqual(50);
      expect(headerMetrics.elementAtHeaderInsideHeader).toBe(true);
      expect(headerMetrics.position).toBe("fixed");
      expect(Math.round(headerMetrics.top)).toBe(0);
      expect(headerMetrics.height).toBeGreaterThanOrEqual(64);
      expect(Math.round(headerMetrics.left)).toBe(0);
      expect(Math.round(headerMetrics.right)).toBe(
        headerMetrics.documentClientWidth,
      );
      expect(Math.round(headerMetrics.width)).toBe(
        headerMetrics.documentClientWidth,
      );
      expect(headerMetrics.maxWidth).toBe("none");
      expect(headerMetrics.transform).toBe("none");

      const navDisplay = await page
        .locator(".landing-header-nav")
        .evaluate((node) => window.getComputedStyle(node).display);
      const viewport = page.viewportSize();
      if ((viewport?.width ?? 0) <= 900) {
        expect(navDisplay).toBe("none");
      } else {
        expect(navDisplay).not.toBe("none");
      }

      await page.evaluate(() => window.scrollTo(0, 900));
      await expect
        .poll(() =>
          landingHeader.evaluate((node) =>
            Math.round(node.getBoundingClientRect().top),
          ),
        )
        .toBe(0);

      await page.locator("#preview").scrollIntoViewIfNeeded();
      await expect(page.locator(".landing-layout-work")).toHaveCount(3);
      await expect(
        page.locator(".landing-layout-work").filter({ hasText: "대시보드" }),
      ).toBeVisible();
      await expect(
        page.locator(".landing-layout-work").filter({ hasText: "AI 피드백" }),
      ).toBeVisible();
      await expect(
        page.locator(".landing-layout-work").filter({ hasText: "성장 리포트" }),
      ).toBeVisible();

      await page.locator("#services").scrollIntoViewIfNeeded();
      await expect(page.getByText("학습 현황부터")).toBeVisible();
      await expect(page.getByText("쓰기 답안 AI 첨삭")).toBeVisible();
      await page.locator("#features").scrollIntoViewIfNeeded();
      await expect(page.locator(".landing-layout-feature")).toHaveCount(4);
      await expect(
        page.locator(".landing-layout-feature").filter({ hasText: "AI 첨삭" }),
      ).toBeVisible();
      await expect(
        page
          .locator(".landing-layout-feature")
          .filter({ hasText: "실전 문제" }),
      ).toBeVisible();
      await expect(
        page
          .locator(".landing-layout-feature")
          .filter({ hasText: "성장 리포트" }),
      ).toBeVisible();
      await expect(
        page
          .locator(".landing-layout-feature")
          .filter({ hasText: "라이브러리" }),
      ).toBeVisible();
      await page.locator("#blog").scrollIntoViewIfNeeded();
      await expect(page.getByText("Future scope").first()).toBeVisible();
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await expect(page.getByText("TALKPIK AI로 시작하기")).toBeVisible();

      const signupPill = page
        .locator(".landing-layout-pill[href='/sign-up']")
        .first();
      await expect(signupPill).toBeVisible();
      const signupPillMetrics = await signupPill.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const svgRect = node.querySelector("svg")?.getBoundingClientRect();
        return {
          height: rect.height,
          svgWidth: svgRect?.width ?? 0,
        };
      });
      expect(signupPillMetrics.height).toBeLessThanOrEqual(56);
      expect(signupPillMetrics.svgWidth).toBeLessThanOrEqual(24);

      await expect(
        page.locator(".landing-layout-service__frame .landing-layout-number"),
      ).toHaveCount(0);

      const sentenceNumberCount = await page
        .locator(
          [
            ".landing-layout-work__caption p .landing-layout-number",
            ".landing-layout-service p .landing-layout-number",
            ".landing-layout-step-list p .landing-layout-number",
            ".landing-layout-feature h3 .landing-layout-number",
          ].join(", "),
        )
        .count();
      expect(sentenceNumberCount).toBe(0);

      const inlineNumberParagraph = page
        .locator(".landing-layout-work__caption p")
        .filter({ hasText: "51" })
        .first();
      await expect(inlineNumberParagraph).toBeVisible();
      const inlineParagraphFont = await inlineNumberParagraph.evaluate(
        (node) => window.getComputedStyle(node).fontFamily,
      );
      expect(inlineParagraphFont).not.toContain("Montserrat");

      const numberOnlyPathMarkers = await page
        .locator(".landing-layout-path > strong .landing-layout-number")
        .count();
      expect(numberOnlyPathMarkers).toBe(1);

      const animatedSections = await page
        .locator("[data-landing-section]")
        .count();
      expect(animatedSections).toBeGreaterThanOrEqual(8);
      const staggerTargets = await page
        .locator("[data-landing-stagger]")
        .count();
      expect(staggerTargets).toBeGreaterThanOrEqual(20);

      const swiperRoot = page.locator(".landing-layout-testimonials.swiper");
      await expect(swiperRoot).toBeVisible();
      expect(
        await swiperRoot.evaluate((node) =>
          node.hasAttribute("data-landing-stagger"),
        ),
      ).toBe(true);
      await expect(
        page.locator(
          ".landing-layout-testimonials__slide[data-landing-stagger]",
        ),
      ).toHaveCount(0);
      const swiperSlides = await page
        .locator(".landing-layout-testimonials__slide")
        .count();
      expect(swiperSlides).toBeGreaterThanOrEqual(4);
      const carouselMotion = await swiperRoot
        .locator(".swiper-wrapper")
        .evaluate(async (node) => {
          const before = window.getComputedStyle(node).transform;
          await new Promise((resolve) => window.setTimeout(resolve, 800));
          return {
            before,
            after: window.getComputedStyle(node).transform,
          };
        });
      expect(carouselMotion.after).not.toBe(carouselMotion.before);

      const revealedFeature = page
        .locator(".landing-layout-feature[data-landing-stagger]")
        .first();
      await revealedFeature.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          revealedFeature.evaluate((node) =>
            Number(window.getComputedStyle(node).opacity),
          ),
        )
        .toBeGreaterThan(0.9);

      const flowLines = page.locator(
        ".landing-layout-step-list article[data-landing-line]",
      );
      await expect(flowLines).toHaveCount(4);
      await page.locator(".landing-layout-step-list").scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          flowLines
            .nth(1)
            .evaluate((node) =>
              Number(
                window
                  .getComputedStyle(node)
                  .getPropertyValue("--landing-line-scale")
                  .trim() || "1",
              ),
            ),
        )
        .toBeGreaterThan(0.9);
      await expect
        .poll(() =>
          flowLines.nth(1).evaluate((node) => {
            const styles = window.getComputedStyle(node, "::before");

            return styles.transform;
          }),
        )
        .not.toBe("matrix(0, 0, 0, 1, 0, 0)");
      const flowLineColor = await flowLines
        .nth(1)
        .evaluate(
          (node) => window.getComputedStyle(node, "::before").backgroundColor,
        );
      expect(flowLineColor).toBe("rgb(185, 185, 179)");

      const pageText = await page.locator("body").innerText();
      expect(pageText).not.toContain("Paul Richards");
      expect(pageText).not.toContain("Framer");
      expect(pageText).not.toContain("$299");

      const horizontalOverflow = await page.evaluate(
        () => document.body.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }

    expect(
      errors,
      `uncaught page errors on ${s.route}:\n${errors.join("\n")}`,
    ).toEqual([]);
  });
}
