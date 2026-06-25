import { beforeEach, describe, expect, it, vi } from "vitest";

import { PDF_EXPORT_DEFAULT_OPTIONS } from "../../../src/lib/export/pdf-options";
import { PDF_EXPORT_ERROR_CODES } from "../../../src/lib/export/pdf-export-errors";
import {
  assertMonthlyPdfExportLimit,
  PdfExportRequestError,
  resolvePdfExportItems,
} from "../../../src/lib/export/pdf-export-server";
import { getSubmission } from "../../../src/lib/writing/server";

vi.mock("../../../src/lib/writing/server", () => ({
  getFeedbackBundle: vi.fn(),
  getSubmission: vi.fn(),
}));

const exportOptions = {
  filename: "failed-analysis",
  ...PDF_EXPORT_DEFAULT_OPTIONS,
};

function failedSubmission() {
  return {
    id: "sub-failed",
    user_id: "user-1",
    problem_id: "problem-1",
    question_no: 51,
    answer_text: "answer",
    answer_json: null,
    char_count: 6,
    submitted_at: "2026-06-17T12:00:00.000Z",
    feedback_status: "failed",
    parent_submission_id: null,
    draft_id: null,
  };
}

function pdfSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "library_items") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: "lib-1",
                  item_type: "submission",
                  submission_id: "sub-failed",
                  report_id: null,
                  saved_at: "2026-06-17T12:00:00.000Z",
                },
              ],
              error: null,
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { title: "Failed analysis problem" },
              error: null,
            })),
          })),
        })),
      };
    }),
  };
}

beforeEach(() => {
  vi.mocked(getSubmission).mockReset();
});

describe("assertMonthlyPdfExportLimit", () => {
  it("allows the third monthly PDF export attempt", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ count: 2, error: null })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(
      assertMonthlyPdfExportLimit(
        supabase as never,
        "user-1",
        new Date("2026-06-17T12:00:00.000Z"),
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks the fourth monthly PDF export attempt", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ count: 3, error: null })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(
      assertMonthlyPdfExportLimit(
        supabase as never,
        "user-1",
        new Date("2026-06-17T12:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(PdfExportRequestError);
  });

  it("rejects direct PDF export for failed-analysis submissions", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce(failedSubmission() as never);

    await expect(
      resolvePdfExportItems(pdfSupabaseMock() as never, {
        sourceType: "submission",
        sourceId: "sub-failed",
        options: exportOptions,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
    });
  });

  it("rejects library-selection PDF export when a selected submission failed analysis", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce(failedSubmission() as never);

    await expect(
      resolvePdfExportItems(pdfSupabaseMock() as never, {
        sourceType: "library_selection",
        itemIds: ["lib-1"],
        options: exportOptions,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
    });
  });
});
