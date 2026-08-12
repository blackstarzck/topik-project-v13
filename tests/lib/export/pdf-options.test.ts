import { describe, expect, it } from "vitest";

import {
  PDF_EXPORT_MAX_ITEMS,
  estimatePdfPages,
  pdfExportRequestSchema,
  sanitizePdfFilename,
} from "../../../src/lib/export/pdf-options";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

const BASE_OPTIONS = {
  filename: "내서재-내보내기",
  includeAnswers: true,
  includeFeedback: true,
  layout: "paged",
  orientation: "portrait",
} as const;

describe("pdfExportRequestSchema", () => {
  it("accepts a submission request with a uuid sourceId", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "submission",
      sourceId: UUID_A,
      options: BASE_OPTIONS,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed (non-uuid) sourceId", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "submission",
      sourceId: "잘못된id",
      options: BASE_OPTIONS,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects library_selection with more than the max items", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "library_selection",
      itemIds: Array.from({ length: PDF_EXPORT_MAX_ITEMS + 1 }, () => UUID_A),
      options: BASE_OPTIONS,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts library_selection with 1..max uuid items", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "library_selection",
      itemIds: [UUID_A, UUID_B],
      options: BASE_OPTIONS,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate library item ids before the request reaches the route", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "library_selection",
      itemIds: [UUID_A, UUID_A],
      options: BASE_OPTIONS,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown layout / orientation values", () => {
    const parsed = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "submission",
      sourceId: UUID_A,
      options: { ...BASE_OPTIONS, layout: "fancy" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty or too-long filename", () => {
    const empty = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "submission",
      sourceId: UUID_A,
      options: { ...BASE_OPTIONS, filename: "   " },
    });
    expect(empty.success).toBe(false);

    const tooLong = pdfExportRequestSchema.safeParse({
      requestId: REQUEST_ID,
      sourceType: "submission",
      sourceId: UUID_A,
      options: { ...BASE_OPTIONS, filename: "가".repeat(61) },
    });
    expect(tooLong.success).toBe(false);
  });

  it("requires a valid UUID request id for retry idempotency", () => {
    const missing = pdfExportRequestSchema.safeParse({
      sourceType: "submission",
      sourceId: UUID_A,
      options: BASE_OPTIONS,
    });
    const malformed = pdfExportRequestSchema.safeParse({
      requestId: "not-a-uuid",
      sourceType: "submission",
      sourceId: UUID_A,
      options: BASE_OPTIONS,
    });

    expect(missing.success).toBe(false);
    expect(malformed.success).toBe(false);
  });
});

describe("estimatePdfPages", () => {
  it("paged layout: items × (answers + feedback)", () => {
    expect(
      estimatePdfPages({
        itemCount: 4,
        includeAnswers: true,
        includeFeedback: true,
        layout: "paged",
      }),
    ).toBe(8);
  });

  it("continuous layout compresses the estimate", () => {
    const paged = estimatePdfPages({
      itemCount: 4,
      includeAnswers: true,
      includeFeedback: true,
      layout: "paged",
    });
    const continuous = estimatePdfPages({
      itemCount: 4,
      includeAnswers: true,
      includeFeedback: true,
      layout: "continuous",
    });
    expect(continuous).toBeLessThan(paged);
    expect(continuous).toBeGreaterThanOrEqual(1);
  });

  it("never returns less than 1 page (nothing included)", () => {
    expect(
      estimatePdfPages({
        itemCount: 1,
        includeAnswers: false,
        includeFeedback: false,
        layout: "continuous",
      }),
    ).toBe(1);
  });
});

describe("sanitizePdfFilename", () => {
  it("keeps Korean and removes path/reserved characters", () => {
    expect(sanitizePdfFilename('내 답안<>:"/\\|?*리포트')).toBe(
      "내 답안리포트",
    );
  });

  it("falls back to a default when everything is stripped", () => {
    expect(sanitizePdfFilename("///***???")).toBe("dotore-topik-export");
  });

  it("truncates to the max length", () => {
    expect(sanitizePdfFilename("가".repeat(120))).toHaveLength(60);
  });
});
