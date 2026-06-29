import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Local e2e runs load .env.local; CI envs can provide the same variables.
  }
}

loadEnvLocal();

type ProblemCandidate = {
  id: string;
  chartTypes: Set<string>;
};

const REQUIRED_CHART_TYPES = ["bar", "donut", "line", "pie"] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for Q53 chart e2e");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function uniqueRecords(
  values: Array<Record<string, unknown> | null | undefined>,
) {
  const seen = new Set<Record<string, unknown>>();
  return values.filter((value): value is Record<string, unknown> => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function extractChartContainers(materials: unknown) {
  const root = asRecord(materials);
  const rawPayload = asRecord(root?.raw_payload);
  const nestedMaterials = asRecord(root?.materials);
  const sources = uniqueRecords([
    root,
    asRecord(root?.source_data),
    rawPayload,
    asRecord(rawPayload?.source_data),
    nestedMaterials,
    asRecord(nestedMaterials?.source_data),
  ]);

  return uniqueRecords(
    sources.flatMap((source) => {
      const sourceData = asRecord(source.source_data);
      return [
        asRecord(source.charts),
        asRecord(sourceData?.charts),
        sourceData,
        source,
      ];
    }),
  );
}

function extractChartTypes(materials: unknown): Set<string> {
  const values = extractChartContainers(materials).flatMap((container) => {
    const charts = asRecord(container.charts);
    return charts
      ? Object.values(charts)
      : [container.chart_a, container.chart_b, container.chart_c];
  });

  return new Set(
    values
      .map((chart) => asRecord(chart)?.chart_type)
      .filter(
        (chartType): chartType is string => typeof chartType === "string",
      ),
  );
}

async function findChartProblems() {
  const sb = serviceClient();
  const problems = await sb
    .from("problems")
    .select("id, materials")
    .eq("domain", "writing")
    .eq("question_no", 53)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(100);
  if (problems.error) throw problems.error;

  const candidates: ProblemCandidate[] = (problems.data ?? []).map(
    (problem) => ({
      id: problem.id,
      chartTypes: extractChartTypes(problem.materials),
    }),
  );

  const selected = new Map<string, ProblemCandidate>();
  for (const chartType of REQUIRED_CHART_TYPES) {
    const problem =
      candidates.find(
        (candidate) =>
          candidate.chartTypes.has(chartType) && !selected.has(candidate.id),
      ) ?? candidates.find((candidate) => candidate.chartTypes.has(chartType));
    if (!problem) {
      throw new Error(`No published Q53 ${chartType} chart problem found`);
    }
    selected.set(problem.id, problem);
  }

  return Array.from(selected.values());
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function countMaterialElements(page: Page, selector: string) {
  return page.evaluate((innerSelector) => {
    const root = document.querySelector('[data-testid="q53-material-cards"]');
    return root?.querySelectorAll(innerSelector).length ?? 0;
  }, selector);
}

function normalizeVisibleText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function verifyValueRowsActivateChartTooltips(page: Page) {
  const cards = page.getByTestId("q53-material-data-card");
  const cardCount = await cards.count();

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const card = cards.nth(cardIndex);
    const rows = card.getByTestId("q53-material-value-row");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = rows.nth(rowIndex);
      await expect(row).toBeVisible();
      const rowLabel = normalizeVisibleText(
        await row.locator(".writing-material-value-list__label").innerText(),
      );
      const rowValue = normalizeVisibleText(
        await row.locator(".writing-material-value-list__value").innerText(),
      );
      const inactiveBackground = await row.evaluate(
        (element) => window.getComputedStyle(element).backgroundColor,
      );

      await row.hover();
      await expect(row).toHaveClass(/writing-material-value-list__row--active/);
      await expect
        .poll(async () =>
          card.evaluate((cardElement) => {
            const cardRect = cardElement.getBoundingClientRect();
            const tooltips = Array.from(
              cardElement.querySelectorAll(".recharts-tooltip-wrapper"),
            );
            return tooltips.some((tooltip) => {
              const style = window.getComputedStyle(tooltip);
              const rect = tooltip.getBoundingClientRect();
              const intersectsCard =
                rect.left < cardRect.right &&
                rect.right > cardRect.left &&
                rect.top < cardRect.bottom &&
                rect.bottom > cardRect.top;
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0 &&
                intersectsCard &&
                tooltip.textContent?.trim()
              );
            });
          }),
        )
        .toBeTruthy();

      const activeBackground = await row.evaluate(
        (element) => window.getComputedStyle(element).backgroundColor,
      );
      const tooltipText = normalizeVisibleText(
        await card.locator(".recharts-tooltip-wrapper").innerText(),
      );
      const tooltipDistanceFromMark = await card.evaluate(
        (cardElement, activeRowIndex) => {
          const rowCount = cardElement.querySelectorAll(
            '[data-testid="q53-material-value-row"]',
          ).length;
          const tooltip = Array.from(
            cardElement.querySelectorAll<HTMLElement>(
              ".recharts-tooltip-wrapper",
            ),
          ).find((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              style.opacity !== "0" &&
              rect.width > 0 &&
              rect.height > 0 &&
              element.textContent?.trim()
            );
          });
          const sectors = Array.from(
            cardElement.querySelectorAll<SVGGraphicsElement>(
              ".recharts-pie-sector path",
            ),
          );
          const dots = Array.from(
            cardElement.querySelectorAll<SVGGraphicsElement>(
              ".recharts-line-dot",
            ),
          );
          const bars = Array.from(
            cardElement.querySelectorAll<SVGGraphicsElement>(
              ".recharts-bar-rectangle .recharts-rectangle:not(.recharts-tooltip-cursor)",
            ),
          );
          const marks = sectors.length ? sectors : dots.length ? dots : bars;
          if (!tooltip || marks.length === 0) return Number.POSITIVE_INFINITY;

          const seriesStride =
            rowCount > 0 && rowCount < marks.length
              ? Math.max(1, Math.floor(marks.length / rowCount))
              : 1;
          const markIndex =
            rowCount > 0 && rowCount < marks.length
              ? activeRowIndex * seriesStride
              : activeRowIndex;
          const mark = marks[markIndex] ?? marks[0];
          const tooltipRect = tooltip.getBoundingClientRect();
          const markRect = mark.getBoundingClientRect();
          const targetPoint = {
            x: markRect.left + markRect.width / 2,
            y:
              bars.includes(mark) && dots.length === 0 && sectors.length === 0
                ? markRect.top
                : markRect.top + markRect.height / 2,
          };
          const dx = Math.max(
            tooltipRect.left - targetPoint.x,
            0,
            targetPoint.x - tooltipRect.right,
          );
          const dy = Math.max(
            tooltipRect.top - targetPoint.y,
            0,
            targetPoint.y - tooltipRect.bottom,
          );

          return Math.hypot(dx, dy);
        },
        rowIndex,
      );

      expect(activeBackground).not.toBe(inactiveBackground);
      expect(activeBackground).not.toMatch(
        /^(rgba\(0,\s*0,\s*0,\s*0\)|transparent)$/,
      );
      expect(tooltipText).toContain(rowLabel);
      expect(tooltipText).toContain(rowValue);
      expect(tooltipDistanceFromMark).toBeLessThanOrEqual(25);

      await page.mouse.move(0, 0);
      await expect(row).not.toHaveClass(
        /writing-material-value-list__row--active/,
      );
    }
  }
}

test("Q53 material charts render without clipped axes, legends, or hidden value tables", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const problems = await findChartProblems();

  for (const problem of problems) {
    await page.goto(`/writing/long-form-writing-53?problem=${problem.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/long-form-writing-53/);
    await expect(page.getByTestId("q53-material-cards")).toBeVisible();
    await expect
      .poll(() =>
        countMaterialElements(page, '[data-testid="q53-material-chart"]'),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        countMaterialElements(page, '[data-testid="q53-material-value-list"]'),
      )
      .toBeGreaterThan(0);
    if (problem.chartTypes.has("bar") || problem.chartTypes.has("line")) {
      await expect
        .poll(() =>
          countMaterialElements(
            page,
            ".recharts-rectangle, .recharts-line-curve",
          ),
        )
        .toBeGreaterThan(0);
    }
    if (problem.chartTypes.has("donut") || problem.chartTypes.has("pie")) {
      await expect
        .poll(() => countMaterialElements(page, ".recharts-sector"))
        .toBeGreaterThan(0);
    }

    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="q53-material-cards"]');
      if (!root) {
        return {
          chartCount: 0,
          clippedTables: ["material root missing"],
          clippedYAxisTicks: ["material root missing"],
          cartesianMarkCount: 0,
          borderedValueLists: [],
          borderedValueRows: ["material root missing"],
          legendCount: 0,
          markColors: [],
          misalignedValueRows: ["material root missing"],
          mismatchedBulletGroups: [],
          invisibleBullets: ["material root missing"],
          oversizedRadials: [],
          radialSectorCount: 0,
          tableElementCount: 0,
          valueListCount: 0,
        };
      }

      const charts = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-testid="q53-material-chart"]',
        ),
      );
      const valueTables = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-testid="q53-material-value-list"]',
        ),
      );
      const clippedTables = valueTables.flatMap((table, index) => {
        const hiddenHorizontally = table.scrollWidth > table.clientWidth + 1;
        const hiddenVertically = table.scrollHeight > table.clientHeight + 1;
        return hiddenHorizontally || hiddenVertically
          ? [
              `table-${index}: ${table.clientWidth}x${table.clientHeight}/${table.scrollWidth}x${table.scrollHeight}`,
            ]
          : [];
      });

      const clippedYAxisTicks = charts.flatMap((chart, chartIndex) => {
        const svg = chart.querySelector<SVGSVGElement>("svg");
        const svgRect = svg?.getBoundingClientRect();
        if (
          !svg ||
          !svgRect ||
          !chart.classList.contains("writing-material-chart--cartesian")
        ) {
          return [];
        }
        return Array.from(
          chart.querySelectorAll<SVGTextElement>(".recharts-yAxis text"),
        ).flatMap((tick, tickIndex) => {
          const rect = tick.getBoundingClientRect();
          const clipped =
            rect.left < svgRect.left + 1 ||
            rect.right > svgRect.right - 1 ||
            rect.top < svgRect.top + 1 ||
            rect.bottom > svgRect.bottom - 1;
          return clipped ? [`chart-${chartIndex}/tick-${tickIndex}`] : [];
        });
      });

      const markElements = Array.from(
        root.querySelectorAll<SVGElement>(
          [
            ".recharts-rectangle",
            ".recharts-line-curve",
            ".recharts-sector",
          ].join(","),
        ),
      );
      const visiblePaints = (mark: SVGElement) => {
        const computed = window.getComputedStyle(mark);
        return [
          mark.getAttribute("fill") ?? "",
          mark.getAttribute("stroke") ?? "",
          computed.fill,
          computed.stroke,
        ].filter(
          (color) =>
            Boolean(color) &&
            color !== "none" &&
            color !== "transparent" &&
            color !== "rgba(0, 0, 0, 0)",
        );
      };
      const markColors = markElements.flatMap((mark) => visiblePaints(mark));

      const oversizedRadials = charts.flatMap((chart, chartIndex) => {
        const sectors = Array.from(
          chart.querySelectorAll<SVGElement>(".recharts-pie-sector path"),
        );
        if (sectors.length === 0) return [];
        const chartRect = chart.getBoundingClientRect();
        const sectorRects = sectors.map((sector) =>
          sector.getBoundingClientRect(),
        );
        const left = Math.min(...sectorRects.map((rect) => rect.left));
        const right = Math.max(...sectorRects.map((rect) => rect.right));
        const top = Math.min(...sectorRects.map((rect) => rect.top));
        const bottom = Math.max(...sectorRects.map((rect) => rect.bottom));
        const ratio = Math.max(
          (right - left) / chartRect.width,
          (bottom - top) / chartRect.height,
        );

        return ratio > 0.72 ? [`chart-${chartIndex}: ${ratio.toFixed(2)}`] : [];
      });
      const borderedValueLists = valueTables.flatMap((list, index) => {
        const style = window.getComputedStyle(list);
        const hasBorder = [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].some((width) => width !== "0px");
        return hasBorder ? [`list-${index}`] : [];
      });
      const borderedValueRows = valueTables.flatMap((list, listIndex) =>
        Array.from(
          list.querySelectorAll<HTMLElement>(
            ".writing-material-value-list__row",
          ),
        ).flatMap((row, rowIndex) => {
          const style = window.getComputedStyle(row);
          const hasBorder = [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ].some((width) => width !== "0px");
          return hasBorder ? [`list-${listIndex}/row-${rowIndex}`] : [];
        }),
      );
      const misalignedValueRows = valueTables.flatMap((list, listIndex) =>
        Array.from(
          list.querySelectorAll<HTMLElement>(
            ".writing-material-value-list__row",
          ),
        ).flatMap((row, rowIndex) => {
          const rowStyle = window.getComputedStyle(row);
          const value = row.querySelector<HTMLElement>(
            ".writing-material-value-list__value",
          );
          const valueStyle = value ? window.getComputedStyle(value) : null;
          const isAligned =
            rowStyle.display === "grid" && valueStyle?.textAlign === "right";
          return isAligned ? [] : [`list-${listIndex}/row-${rowIndex}`];
        }),
      );
      const invisibleBullets = valueTables.flatMap((list, listIndex) =>
        Array.from(
          list.querySelectorAll<HTMLElement>(
            '[data-testid="q53-material-value-bullet"]',
          ),
        ).flatMap((bullet, bulletIndex) => {
          const style = window.getComputedStyle(bullet);
          const width = Number.parseFloat(style.width);
          const height = Number.parseFloat(style.height);
          const isVisible =
            style.display !== "none" &&
            width > 0 &&
            height > 0 &&
            style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
            style.backgroundColor !== "transparent";
          return isVisible ? [] : [`list-${listIndex}/bullet-${bulletIndex}`];
        }),
      );
      const mismatchedBulletGroups = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-testid="q53-material-data-card"]',
        ),
      ).flatMap((card, cardIndex) => {
        const chartMarkColors = Array.from(
          card.querySelectorAll<SVGElement>(
            ".recharts-rectangle, .recharts-line-curve, .recharts-sector",
          ),
        ).flatMap((mark) => visiblePaints(mark));
        const uniqueChartColors = new Set(chartMarkColors);
        const bulletColors = Array.from(
          card.querySelectorAll<HTMLElement>(
            '[data-testid="q53-material-value-bullet"]',
          ),
        )
          .map((bullet) => bullet.dataset.color ?? "")
          .filter(Boolean);

        if (bulletColors.length === 0) return [];
        return bulletColors.every((color) => uniqueChartColors.has(color))
          ? []
          : [`card-${cardIndex}`];
      });

      return {
        cartesianMarkCount: root.querySelectorAll(
          ".recharts-rectangle, .recharts-line-curve",
        ).length,
        borderedValueLists,
        borderedValueRows,
        chartCount: charts.length,
        clippedTables,
        clippedYAxisTicks,
        legendCount: root.querySelectorAll(".recharts-legend-wrapper").length,
        markColors,
        misalignedValueRows,
        mismatchedBulletGroups,
        invisibleBullets,
        oversizedRadials,
        radialSectorCount: root.querySelectorAll(".recharts-sector").length,
        tableElementCount: root.querySelectorAll(
          '[data-testid="q53-material-value-list"] table, .writing-material-table-wrap table',
        ).length,
        valueListCount: valueTables.length,
      };
    });

    expect(metrics.chartCount).toBeGreaterThan(0);
    if (problem.chartTypes.has("bar") || problem.chartTypes.has("line")) {
      expect(metrics.cartesianMarkCount).toBeGreaterThan(0);
    }
    if (problem.chartTypes.has("donut") || problem.chartTypes.has("pie")) {
      expect(metrics.radialSectorCount).toBeGreaterThan(0);
    }
    expect(metrics.valueListCount).toBe(metrics.chartCount);
    expect(metrics.tableElementCount).toBe(0);
    expect(metrics.borderedValueLists).toEqual([]);
    expect(metrics.borderedValueRows).toEqual([]);
    expect(metrics.misalignedValueRows).toEqual([]);
    expect(metrics.invisibleBullets).toEqual([]);
    expect(metrics.legendCount).toBe(0);
    expect(metrics.clippedYAxisTicks).toEqual([]);
    expect(metrics.clippedTables).toEqual([]);
    expect(metrics.mismatchedBulletGroups).toEqual([]);
    expect(metrics.oversizedRadials).toEqual([]);
    expect(metrics.markColors.length).toBeGreaterThan(0);
    for (const color of metrics.markColors) {
      expect(color).not.toMatch(/rgb\(0,\s*0,\s*0\)|black/i);
      expect(color).not.toMatch(/(^|\s)#?000(000)?($|\s)/i);
    }

    await verifyValueRowsActivateChartTooltips(page);
  }

  const renderedChartTypes = new Set(
    problems.flatMap((problem) => [...problem.chartTypes]),
  );
  expect(
    [...REQUIRED_CHART_TYPES].every((chartType) =>
      renderedChartTypes.has(chartType),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
