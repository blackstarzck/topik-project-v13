import { test, expect, type Page } from "@playwright/test";

// Tier 2 — per-screen validation for AUTHED (workspace) screens. Uses the
// storageState produced by the `setup` project (learner session). Runs in all
// three viewport projects for responsive coverage.
//
// Each screen asserts: it did NOT bounce to /login (auth works), the route
// rendered (a heading is visible = hydration), and ZERO uncaught page errors.
//
// Durable, existing audit submissions (not created by this suite):
//   short feedback ...051, long feedback ...053.
// R-01 compare is intentionally excluded here (depends on an ephemeral seeded
// report id); it is covered by the capture pass and the Tier-3 flow.
const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051";
const SUB_LONG = "a0d17000-0000-4000-8000-000000000053";

type Screen = { ia: string; name: string; route: string; pathRegex: RegExp };

const AUTHED_SCREENS: Screen[] = [
  {
    ia: "A-03",
    name: "learning-goal-setup",
    route: "/onboarding/learning-goal",
    pathRegex: /\/onboarding\/learning-goal/,
  },
  {
    ia: "B-01",
    name: "home-dashboard",
    route: "/dashboard",
    pathRegex: /\/dashboard/,
  },
  {
    ia: "C-01",
    name: "problem-type-recommendations",
    route: "/practice/recommendations",
    pathRegex: /\/practice\/recommendations/,
  },
  {
    ia: "C-02",
    name: "problem-list",
    route: "/practice/problems",
    pathRegex: /\/practice\/problems/,
  },
  {
    ia: "D-01",
    name: "short-answer-writing-51",
    route: "/writing/short-answer-writing-51",
    pathRegex: /short-answer-writing-51/,
  },
  {
    ia: "D-02",
    name: "answer-writing-52",
    route: "/writing/answer-writing-52",
    pathRegex: /answer-writing-52/,
  },
  {
    ia: "D-03",
    name: "long-form-writing-53",
    route: "/writing/long-form-writing-53",
    pathRegex: /long-form-writing-53/,
  },
  {
    ia: "D-04",
    name: "essay-writing-54",
    route: "/writing/essay-writing-54",
    pathRegex: /essay-writing-54/,
  },
  {
    ia: "E-01",
    name: "short-answer-feedback",
    route: `/writing/feedback/short/${SUB_SHORT}`,
    pathRegex: /\/writing\/feedback\/short\//,
  },
  {
    ia: "E-02",
    name: "long-form-feedback",
    route: `/writing/feedback/long/${SUB_LONG}`,
    pathRegex: /\/writing\/feedback\/long\//,
  },
  {
    ia: "R-02",
    name: "next-problem-recommendation",
    route: "/practice/next",
    pathRegex: /\/practice\/next/,
  },
  { ia: "F-01", name: "my-library", route: "/library", pathRegex: /\/library/ },
  {
    ia: "G-01",
    name: "language-settings",
    route: "/settings/language",
    pathRegex: /\/settings\/language/,
  },
  {
    ia: "X-02",
    name: "growth-dashboard",
    route: "/growth",
    pathRegex: /\/growth/,
  },
  { ia: "X-03", name: "paywall", route: "/paywall", pathRegex: /\/paywall/ },
  {
    ia: "X-04",
    name: "subscription-management",
    route: "/subscription",
    pathRegex: /\/subscription/,
  },
  {
    ia: "X-05",
    name: "profile-editing",
    route: "/profile",
    pathRegex: /\/profile/,
  },
  {
    ia: "X-07",
    name: "weakness-based-recommendations",
    route: "/practice/weakness",
    pathRegex: /\/practice\/weakness/,
  },
  {
    ia: "X-09",
    name: "notification-settings",
    route: "/settings/notifications",
    pathRegex: /\/settings\/notifications/,
  },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function expectWritingPageUsesFlushBullets(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector(".writing-workspace");
    if (!root) {
      return {
        bulletlessItemCount: 0,
        indentedListCount: 0,
        listCount: 0,
        orderedListCount: 0,
        rootFound: false,
      };
    }

    const lists = Array.from(
      root.querySelectorAll<HTMLUListElement>("ul.writing-guide-list"),
    );
    const indentedListCount = lists.filter((list) => {
      const style = window.getComputedStyle(list);
      const paddingStart =
        Number.parseFloat(style.paddingInlineStart || style.paddingLeft) || 0;
      const marginStart =
        Number.parseFloat(style.marginInlineStart || style.marginLeft) || 0;

      return (
        paddingStart > 1 || marginStart > 1 || style.listStyleType !== "none"
      );
    }).length;
    const bulletlessItemCount = Array.from(
      root.querySelectorAll<HTMLLIElement>("ul.writing-guide-list > li"),
    ).filter((item) => {
      const marker = window.getComputedStyle(item, "::before").content;
      return marker === "none" || marker === "normal";
    }).length;

    return {
      bulletlessItemCount,
      indentedListCount,
      listCount: lists.length,
      orderedListCount: root.querySelectorAll("ol").length,
      rootFound: true,
    };
  });

  expect(metrics.rootFound).toBe(true);
  expect(metrics.orderedListCount).toBe(0);
  expect(metrics.indentedListCount).toBe(0);
  expect(metrics.bulletlessItemCount).toBe(0);
}

for (const s of AUTHED_SCREENS) {
  test(`${s.ia} ${s.name} renders authed without page errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(s.route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    // auth held (not bounced to /login) and we are on the intended route.
    await expect(page, "bounced to /login — storageState stale?").not.toHaveURL(
      /\/login/,
    );
    await expect(page).toHaveURL(s.pathRegex);

    // hydration: a heading rendered (workspace shell + page content).
    await expect(page.getByRole("heading").first()).toBeVisible();

    if (
      [
        "short-answer-writing-51",
        "answer-writing-52",
        "long-form-writing-53",
        "essay-writing-54",
      ].includes(s.name)
    ) {
      await expectWritingPageUsesFlushBullets(page);
    }

    if (s.name === "long-form-writing-53") {
      await expect(page.getByTestId("q53-material-data-card")).toHaveCount(2);
      await expect(page.getByTestId("q53-material-reference")).toHaveCount(1);
      await expect(page.getByTestId("q53-material-grid-cell")).toHaveCount(3);
      const materialLayoutMetrics = await page.evaluate(() => {
        const chart = document.querySelector(
          '[data-testid="q53-material-chart"]',
        );
        const chartCell = chart?.closest(".writing-material-card__cell");
        const reference = document.querySelector(
          '[data-testid="q53-material-reference"]',
        );
        const referenceCell = reference?.closest(
          ".writing-material-card__cell",
        );
        const grid = document.querySelector(".writing-material-card__grid");
        const chartCellStyle = chartCell
          ? window.getComputedStyle(chartCell)
          : null;
        const chartStyle = chart ? window.getComputedStyle(chart) : null;
        const referenceCellStyle = referenceCell
          ? window.getComputedStyle(referenceCell)
          : null;
        const referenceRect = reference?.getBoundingClientRect();
        const gridRect = grid?.getBoundingClientRect();

        return {
          chartFound: Boolean(chart),
          chartCellPaddingLeft: chartCellStyle?.paddingLeft ?? null,
          chartMarginInlineStart: chartStyle?.marginInlineStart ?? null,
          referenceCellBorderTopWidth:
            referenceCellStyle?.borderTopWidth ?? null,
          referenceCellGridColumn: referenceCellStyle?.gridColumn ?? null,
          referenceCellPaddingLeft: referenceCellStyle?.paddingLeft ?? null,
          referenceHasHeading: Boolean(
            reference?.querySelector(".writing-material-card__heading"),
          ),
          referenceHasDescription: Boolean(
            reference?.querySelector(".ant-descriptions"),
          ),
          referenceWidthRatio:
            referenceRect && gridRect
              ? referenceRect.width / gridRect.width
              : 0,
        };
      });

      expect(materialLayoutMetrics.chartFound).toBe(true);
      expect(materialLayoutMetrics.chartCellPaddingLeft).toBe("8px");
      expect(materialLayoutMetrics.chartMarginInlineStart).toBe("0px");
      expect(materialLayoutMetrics.referenceCellBorderTopWidth).toBe("0px");
      expect(materialLayoutMetrics.referenceCellGridColumn).toBe("1 / -1");
      expect(materialLayoutMetrics.referenceCellPaddingLeft).toBe("0px");
      expect(materialLayoutMetrics.referenceHasHeading).toBe(false);
      expect(materialLayoutMetrics.referenceHasDescription).toBe(true);
      expect(materialLayoutMetrics.referenceWidthRatio).toBeGreaterThan(0.9);
      const tutorGuideMetrics = await page.evaluate(() => {
        const body = document.querySelector(
          ".writing-guide-accordion__item--tutor .ant-collapse-body",
        );
        const guideList = body?.querySelector("ul.writing-guide-list");
        const guideListStyle = guideList
          ? window.getComputedStyle(guideList)
          : null;
        const copyBlocks = Array.from(body?.querySelectorAll("p, li") ?? []);
        const copyLefts = copyBlocks.map(
          (element) => element.getBoundingClientRect().left,
        );

        return {
          bodyFound: Boolean(body),
          copyLeftSpread:
            copyLefts.length > 0
              ? Math.max(...copyLefts) - Math.min(...copyLefts)
              : 0,
          hasBulletList: Boolean(guideList),
          listPaddingInlineStart:
            guideListStyle?.paddingInlineStart ??
            guideListStyle?.paddingLeft ??
            null,
          listStyleType: guideListStyle?.listStyleType ?? null,
        };
      });

      expect(tutorGuideMetrics.bodyFound).toBe(true);
      expect(tutorGuideMetrics.copyLeftSpread).toBeLessThanOrEqual(1);
      expect(tutorGuideMetrics.hasBulletList).toBe(true);
      expect(tutorGuideMetrics.listPaddingInlineStart).toBe("0px");
      expect(tutorGuideMetrics.listStyleType).toBe("none");

      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 1200) {
        const layoutMetrics = await page.evaluate(() => {
          const support = document
            .querySelector(".writing-grid__support")
            ?.getBoundingClientRect();
          const composer = document
            .querySelector(".writing-grid__composer")
            ?.getBoundingClientRect();
          const composerCard = document
            .querySelector(".writing-grid__composer > .app-card")
            ?.getBoundingClientRect();
          const reviewButton = document.querySelector(
            '[data-testid="q53-review-materials"]',
          );

          return {
            composerCardHeight: composerCard?.height ?? 0,
            composerHeight: composer?.height ?? 0,
            reviewButtonVisible: Boolean(reviewButton),
            supportHeight: support?.height ?? 0,
            viewportHeight: window.innerHeight,
          };
        });
        const targetColumnHeight = Math.max(
          layoutMetrics.supportHeight,
          layoutMetrics.viewportHeight,
        );

        expect(layoutMetrics.composerHeight).toBeGreaterThanOrEqual(
          targetColumnHeight - 2,
        );
        expect(layoutMetrics.composerCardHeight).toBeGreaterThanOrEqual(
          targetColumnHeight - 24,
        );
        expect(layoutMetrics.reviewButtonVisible).toBe(false);
      }

      await expect(page.getByTestId("q53-composer-write-panel")).toBeVisible();
      await expect(
        page.getByTestId("q53-composer-manuscript-panel"),
      ).toBeHidden();
      if (viewport && viewport.width >= 1200) {
        const writeLayoutMetrics = await page.evaluate(() => {
          const panel = document
            .querySelector('[data-testid="q53-composer-write-panel"]')
            ?.getBoundingClientRect();
          const progress = document
            .querySelector(
              '[data-testid="q53-composer-write-panel"] .ant-progress',
            )
            ?.getBoundingClientRect();
          const tabs = document
            .querySelector(
              '[data-testid="q53-composer-write-panel"] .writing-section-tabs',
            )
            ?.getBoundingClientRect();
          const textarea = document
            .querySelector('[data-testid="q53-composer-write-panel"] textarea')
            ?.getBoundingClientRect();

          return {
            panelTop: panel?.top ?? 0,
            progressTop: progress?.top ?? 0,
            tabsTop: tabs?.top ?? 0,
            textareaTop: textarea?.top ?? 0,
          };
        });
        const writeTabsBorderMetrics = await page.evaluate(() => {
          const nav = document.querySelector(
            '[data-testid="q53-composer-write-panel"] .writing-section-tabs .ant-tabs-nav',
          );
          const before = nav ? window.getComputedStyle(nav, "::before") : null;

          return {
            navFound: Boolean(nav),
            beforeBorderBottomWidth: before?.borderBottomWidth ?? null,
          };
        });

        expect(
          writeLayoutMetrics.progressTop - writeLayoutMetrics.panelTop,
        ).toBeLessThan(32);
        expect(
          writeLayoutMetrics.tabsTop - writeLayoutMetrics.progressTop,
        ).toBeLessThan(56);
        expect(
          writeLayoutMetrics.textareaTop - writeLayoutMetrics.tabsTop,
        ).toBeLessThan(128);
        expect(writeTabsBorderMetrics.navFound).toBe(true);
        expect(writeTabsBorderMetrics.beforeBorderBottomWidth).toBe("0px");
      }
      await expect(page.getByRole("tab", { name: "도입" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "전개" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "마무리" })).toBeVisible();
      await expect(page.getByText("도입 — 주제 소개")).toHaveCount(0);
      await expect(page.getByText("전개 — 자료 분석")).toHaveCount(0);
      await expect(page.getByText("마무리 — 정리")).toHaveCount(0);
      await expect(page.getByText("글자수/상태")).toHaveCount(0);
      await expect(page.getByText("문단 0/3")).toHaveCount(0);

      const intro = page.getByRole("textbox").first();
      const composerCard = page.locator(".writing-composer-card");
      const writeTabs = page.locator(
        '[data-testid="q53-composer-write-panel"] .writing-section-tabs .ant-tabs-tab-btn',
      );
      await intro.fill("자료의 변화를 먼저 정리한다.");
      const expectedIntroText = (
        await page.getByRole("textbox").first().inputValue()
      ).replace(/\s+/g, "");
      await writeTabs.nth(1).click();
      await page.getByRole("textbox").first().fill("BodyB");
      await writeTabs.nth(2).click();
      await page.getByRole("textbox").first().fill("EndC");
      await writeTabs.nth(0).click();
      await page.getByTestId("q53-composer-mode-manuscript").click();

      await expect(
        page.getByTestId("q53-composer-manuscript-panel"),
      ).toBeVisible();
      await expect(page.getByTestId("q53-composer-write-panel")).toBeHidden();
      await expect(composerCard.locator(".ant-progress")).toBeVisible();
      await expect(composerCard.locator(".writing-section-tabs")).toBeVisible();
      await expect(page.getByRole("tab", { name: "도입" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "전개" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "마무리" })).toBeVisible();
      await expect(page.getByText("원고지 미리보기")).toHaveCount(0);
      await expect(page.getByText("한 줄 20자 기준")).toHaveCount(0);
      const readHighlightedManuscript = async () =>
        page.evaluate(() => {
          const filledCells = Array.from(
            document.querySelectorAll(
              '[data-testid="manuscript-preview-cell"]',
            ),
          ).filter((cell) => (cell.textContent ?? "").trim().length > 0);
          const highlightedCells = filledCells.filter(
            (cell) => cell.getAttribute("data-highlighted") === "true",
          );

          return {
            highlightedText: highlightedCells
              .map((cell) => cell.textContent ?? "")
              .join(""),
            highlightedSections: Array.from(
              new Set(
                highlightedCells
                  .map((cell) => cell.getAttribute("data-section"))
                  .filter(Boolean),
              ),
            ),
            highlightedHasTint: highlightedCells.every((cell) => {
              const style = window.getComputedStyle(cell);
              return (
                style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                style.backgroundColor !== "transparent"
              );
            }),
            highlightedBackgroundColor:
              highlightedCells.length > 0
                ? window.getComputedStyle(highlightedCells[0]).backgroundColor
                : "",
          };
        });
      const manuscriptTabs = page.locator(
        '[data-testid="q53-composer-manuscript-panel"] .writing-section-tabs .ant-tabs-tab-btn',
      );

      await expect.poll(readHighlightedManuscript).toMatchObject({
        highlightedText: expectedIntroText,
        highlightedSections: ["intro"],
        highlightedHasTint: true,
      });
      const introHighlight = await readHighlightedManuscript();
      await manuscriptTabs.nth(1).click();
      await expect.poll(readHighlightedManuscript).toMatchObject({
        highlightedText: "BodyB",
        highlightedSections: ["body"],
        highlightedHasTint: true,
      });
      const bodyHighlight = await readHighlightedManuscript();
      await manuscriptTabs.nth(2).click();
      await expect.poll(readHighlightedManuscript).toMatchObject({
        highlightedText: "EndC",
        highlightedSections: ["conclusion"],
        highlightedHasTint: true,
      });
      const conclusionHighlight = await readHighlightedManuscript();
      expect(
        new Set([
          introHighlight.highlightedBackgroundColor,
          bodyHighlight.highlightedBackgroundColor,
          conclusionHighlight.highlightedBackgroundColor,
        ]).size,
      ).toBe(3);
      if (viewport && viewport.width >= 1200) {
        const manuscriptMetrics = await page.evaluate(() => {
          const panel = document
            .querySelector('[data-testid="q53-composer-manuscript-panel"]')
            ?.getBoundingClientRect();
          const tabs = document
            .querySelector(
              '[data-testid="q53-composer-manuscript-panel"] .writing-section-tabs',
            )
            ?.getBoundingClientRect();
          const progress = document
            .querySelector(
              '[data-testid="q53-composer-manuscript-panel"] .ant-progress',
            )
            ?.getBoundingClientRect();
          const preview = document
            .querySelector('[data-testid="manuscript-preview"]')
            ?.getBoundingClientRect();
          const firstRow = document
            .querySelector(
              '[data-testid="manuscript-preview-grid"] .writing-manuscript-preview__row',
            )
            ?.getBoundingClientRect();

          return {
            panelHeight: panel?.height ?? 0,
            progressHeight: progress?.height ?? 0,
            firstRowTop: firstRow?.top ?? 0,
            previewHeight: preview?.height ?? 0,
            tabsTop: tabs?.top ?? 0,
            tabsHeight: tabs?.height ?? 0,
          };
        });

        expect(manuscriptMetrics.tabsHeight).toBeLessThan(96);
        expect(
          manuscriptMetrics.firstRowTop - manuscriptMetrics.tabsTop,
        ).toBeLessThan(128);
        expect(manuscriptMetrics.previewHeight).toBeGreaterThanOrEqual(
          manuscriptMetrics.panelHeight -
            manuscriptMetrics.progressHeight -
            manuscriptMetrics.tabsHeight -
            28,
        );
      }

      await page.getByTestId("q53-composer-mode-write").click();
      await expect(page.getByTestId("q53-composer-write-panel")).toBeVisible();
      await writeTabs.nth(0).click();
      await expect(intro).toHaveValue("자료의 변화를 먼저 정리한다.");
    }

    if (s.name === "essay-writing-54") {
      const composerCard = page.locator(".writing-composer-card");
      await expect(composerCard).toHaveCount(1);
      await expect(
        page.locator(".writing-grid__composer > .app-card"),
      ).toHaveCount(1);
      await expect(page.getByText("조건 · 루브릭")).toHaveCount(0);
      await expect(page.getByText("평가 기준")).toHaveCount(1);
      const q54EvaluationCardMetrics = await page.evaluate(() => {
        const title = Array.from(
          document.querySelectorAll(".app-card .ant-card-head-title"),
        ).find((element) => element.textContent?.trim() === "평가 기준");
        const card = title?.closest(".app-card");
        const list = card?.querySelector(
          "ul.writing-guide-list.writing-guide-list--examples",
        );
        const hasDuplicateBodyHeading = Array.from(
          card?.querySelectorAll(".ant-card-body strong") ?? [],
        ).some((element) => element.textContent?.trim() === "평가 기준");

        return {
          cardFound: Boolean(card),
          hasDuplicateBodyHeading,
          itemCount: list?.querySelectorAll("li").length ?? 0,
          listFound: Boolean(list),
        };
      });

      expect(q54EvaluationCardMetrics).toMatchObject({
        cardFound: true,
        hasDuplicateBodyHeading: false,
        itemCount: 3,
        listFound: true,
      });
      await expect(page.getByTestId("q54-composer-write-panel")).toBeVisible();
      await expect(
        page.getByTestId("q54-composer-manuscript-panel"),
      ).toBeHidden();
      await expect(page.getByTestId("q54-composer-mode-write")).toBeVisible();
      await expect(
        page.getByTestId("q54-composer-mode-manuscript"),
      ).toBeVisible();
      await expect(
        page.getByText(
          "서론, 본론, 결론을 구분하고 근거와 연결 표현을 포함하세요.",
        ),
      ).toHaveCount(0);
      await expect(
        page
          .getByTestId("q54-composer-write-panel")
          .locator(".writing-editor-toolbar"),
      ).toHaveCount(0);
      await expect(page.getByText("글자수/상태")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "자동 저장 끄기" }),
      ).toHaveCount(0);
      await expect(page.getByText("원고지 미리보기")).toHaveCount(0);
      await expect(page.getByText("한 줄 20자 기준")).toHaveCount(0);
      const q54Guidance = page.getByTestId("q54-guidance-accordion");
      await expect(q54Guidance).toBeVisible();
      await expect(q54Guidance.getByText("글의 구조 제안")).toBeVisible();
      await expect(q54Guidance.getByText("작성 체크 포인트")).toBeVisible();
      await expect(
        page.locator(".writing-grid__checklist").getByText("아직"),
      ).toHaveCount(0);
      await expect(
        page.locator(".writing-grid__checklist").getByText("부분"),
      ).toHaveCount(0);
      await expect(
        page.locator(".writing-grid__checklist").getByText("완료"),
      ).toHaveCount(0);
      await expect(
        page.locator(".writing-grid__checklist").getByRole("button", {
          name: "조건 다시 보기",
        }),
      ).toHaveCount(0);

      const submitButton = page.getByRole("button", {
        name: "제출하기",
        exact: true,
      });
      const textarea = page.getByRole("textbox", { name: "에세이 본문" });
      await textarea.fill("가".repeat(299));
      await expect(submitButton).toBeDisabled();
      await textarea.fill("가".repeat(300));
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      const confirmModal = page.getByTestId("submission-confirm-modal");
      await expect(confirmModal).toBeVisible();
      await expect(
        confirmModal.getByRole("heading", { name: "답안을 제출하시겠어요?" }),
      ).toBeVisible();
      await expect(
        confirmModal.getByTestId("submission-confirm-submit"),
      ).toBeEnabled();
      await confirmModal.getByTestId("submission-confirm-cancel").click();
      await expect(confirmModal).toBeHidden();

      const answer = "주제에대한입장을분명히밝히고근거를차례로쓴다.";
      await textarea.fill(answer);
      await page.getByTestId("q54-composer-mode-manuscript").click();

      await expect(
        page.getByTestId("q54-composer-manuscript-panel"),
      ).toBeVisible();
      await expect(page.getByTestId("q54-composer-write-panel")).toBeHidden();
      await expect(composerCard.locator(".ant-progress")).toBeVisible();
      await expect(page.getByText("원고지 미리보기")).toHaveCount(0);
      await expect(page.getByText("한 줄 20자 기준")).toHaveCount(0);
      await expect
        .poll(async () =>
          page.evaluate(() =>
            Array.from(
              document.querySelectorAll(
                '[data-testid="manuscript-preview-cell"]',
              ),
            )
              .map((cell) => cell.textContent ?? "")
              .join(""),
          ),
        )
        .toContain(answer);

      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 1200) {
        const q54ComposerMetrics = await page.evaluate(() => {
          const card = document
            .querySelector(".writing-composer-card")
            ?.getBoundingClientRect();
          const mode = document
            .querySelector(".writing-composer-mode")
            ?.getBoundingClientRect();
          const count = document
            .querySelector(".writing-composer-mode .ant-typography")
            ?.getBoundingClientRect();

          return {
            cardHeight: card?.height ?? 0,
            countHeight: count?.height ?? 0,
            modeHeight: mode?.height ?? 0,
          };
        });

        expect(q54ComposerMetrics.cardHeight).toBeGreaterThan(500);
        expect(q54ComposerMetrics.modeHeight).toBeLessThanOrEqual(64);
        expect(q54ComposerMetrics.countHeight).toBeLessThanOrEqual(24);
      }

      await page.getByTestId("q54-composer-mode-write").click();
      await expect(page.getByTestId("q54-composer-write-panel")).toBeVisible();
      await expect(textarea).toHaveValue(answer);
    }

    expect(
      errors,
      `uncaught page errors on ${s.route}:\n${errors.join("\n")}`,
    ).toEqual([]);
  });
}
