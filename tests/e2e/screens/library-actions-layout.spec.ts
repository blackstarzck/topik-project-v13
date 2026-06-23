import { expect, test } from "@playwright/test";

test.describe("F-01 library actions layout", () => {
  test("places the export actions at the bottom of the stats panel with full-width vertical CTAs", async ({
    page,
  }) => {
    await page.goto("/library");

    await expect(
      page,
      "bounced to /login - storageState stale?",
    ).not.toHaveURL(/\/login/);
    await expect(page.getByTestId("library-actions")).toBeVisible();

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
        };
      }

      return {
        stats: rect('[data-testid="library-stats-panel"]'),
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
      };
    });

    expect(metrics.stats).not.toBeNull();
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
    expect(footer.bottom).toBeLessThanOrEqual(stats.bottom + 2);
    expect(Math.abs(footer.bottom - stats.bottom)).toBeLessThanOrEqual(2);
  });
});
