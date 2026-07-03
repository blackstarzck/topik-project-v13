import { expect, test } from "@playwright/test";

test.describe("F-01 library actions layout", () => {
  test("places the export actions at the bottom of the stats panel with full-width vertical CTAs", async ({
    page,
  }) => {
    await page.goto("/library");

    await expect(page, "bounced to /login - storageState stale?").not.toHaveURL(
      /\/login/,
    );
    await expect(page.getByTestId("library-actions")).toBeVisible();

    const viewport = page.viewportSize();
    const isDesktop = (viewport?.width ?? 0) >= 1024;

    // Reproduce the real saved-answer case: the left list can be much taller
    // than the viewport, while the right rail must still keep its CTAs visible.
    if (isDesktop) {
      await page
        .getByTestId("library-list-column")
        .evaluate((el) => ((el as HTMLElement).style.minHeight = "1400px"));
    }

    const metrics = await page.evaluate(() => {
      function rect(selector: string) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          left: r.left,
          width: r.width,
          height: r.height,
        };
      }

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        stats: rect('[data-testid="library-stats-panel"]'),
        statsColumn: rect('[data-testid="library-stats-column"]'),
        listColumn: rect('[data-testid="library-list-column"]'),
        footer: rect('[data-testid="library-stats-actions"]'),
        actions: rect('[data-testid="library-actions"]'),
        stack: rect('[data-testid="library-actions-stack"]'),
        pdf: rect('[data-testid="library-export-pdf"]'),
        review: rect('[data-testid="library-create-review-set"]'),
        hintFontSize: (() => {
          const el = document.querySelector(
            '[data-testid="library-selection-hint"]',
          );
          return el ? getComputedStyle(el).fontSize : null;
        })(),
        footerClass:
          document.querySelector('[data-testid="library-stats-actions"]')
            ?.className ?? "",
        actionsClass:
          document.querySelector('[data-testid="library-actions"]')
            ?.className ?? "",
        statsColumnPosition: (() => {
          const el = document.querySelector(
            '[data-testid="library-stats-column"]',
          );
          return el ? getComputedStyle(el).position : null;
        })(),
        statsColumnTop: (() => {
          const el = document.querySelector(
            '[data-testid="library-stats-column"]',
          );
          return el ? getComputedStyle(el).top : null;
        })(),
        footerPosition: (() => {
          const el = document.querySelector(
            '[data-testid="library-stats-actions"]',
          );
          return el ? getComputedStyle(el).position : null;
        })(),
        footerBottomOffset: (() => {
          const el = document.querySelector(
            '[data-testid="library-stats-actions"]',
          );
          return el ? getComputedStyle(el).bottom : null;
        })(),
      };
    });

    expect(metrics.stats).not.toBeNull();
    expect(metrics.statsColumn).not.toBeNull();
    expect(metrics.listColumn).not.toBeNull();
    expect(metrics.footer).not.toBeNull();
    expect(metrics.actions).not.toBeNull();
    expect(metrics.stack).not.toBeNull();
    expect(metrics.pdf).not.toBeNull();
    expect(metrics.review).not.toBeNull();

    const stats = metrics.stats!;
    const footer = metrics.footer!;
    const actions = metrics.actions!;
    const stack = metrics.stack!;
    const pdf = metrics.pdf!;
    const review = metrics.review!;

    expect(metrics.footerClass).not.toContain("pt-");
    expect(metrics.actionsClass).not.toContain("ant-card");
    expect(metrics.hintFontSize).toBe("14px");
    expect(Math.abs(actions.width - stats.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(stack.left - actions.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(stack.width - actions.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(pdf.width - stack.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(review.width - stack.width)).toBeLessThanOrEqual(2);
    expect(review.top).toBeGreaterThan(pdf.bottom);
    expect(Math.abs(review.left - pdf.left)).toBeLessThanOrEqual(2);
    expect(footer.top).toBeGreaterThanOrEqual(stats.top);

    if (metrics.viewportWidth >= 1024) {
      expect(footer.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
      expect(metrics.listColumn!.height).toBeGreaterThan(
        metrics.viewportHeight,
      );
      expect(metrics.statsColumn!.height).toBeLessThanOrEqual(
        metrics.viewportHeight - 48 + 2,
      );
      expect(metrics.statsColumnPosition).toBe("sticky");
      expect(metrics.statsColumnTop).toBe("24px");
      expect(metrics.footerPosition).toBe("sticky");
      expect(metrics.footerBottomOffset).toBe("24px");
      expect(
        Math.abs(footer.bottom - (metrics.viewportHeight - 24)),
      ).toBeLessThanOrEqual(2);

      await page.evaluate(() => window.scrollTo(0, 360));
      await page.waitForTimeout(100);
      const scrolledMetrics = await page.evaluate(() => {
        function rectFor(el: Element | null) {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            height: r.height,
          };
        }

        const statsPanel = document.querySelector(
          '[data-testid="library-stats-panel"]',
        );

        return {
          viewportHeight: window.innerHeight,
          statsColumn: rectFor(
            document.querySelector('[data-testid="library-stats-column"]'),
          ),
          statsTitle: rectFor(statsPanel?.firstElementChild ?? null),
          footer: rectFor(
            document.querySelector('[data-testid="library-stats-actions"]'),
          ),
        };
      });

      expect(scrolledMetrics.statsColumn).not.toBeNull();
      expect(scrolledMetrics.statsTitle).not.toBeNull();
      expect(scrolledMetrics.footer).not.toBeNull();
      expect(scrolledMetrics.statsColumn!.top).toBeGreaterThanOrEqual(24);
      expect(scrolledMetrics.statsTitle!.top).toBeGreaterThanOrEqual(24);
      expect(
        Math.abs(
          scrolledMetrics.footer!.bottom -
            (scrolledMetrics.viewportHeight - 24),
        ),
      ).toBeLessThanOrEqual(2);
    }
  });
});
