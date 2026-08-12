import { beforeEach, describe, expect, it, vi } from "vitest";

import { PDF_EXPORT_DEFAULT_OPTIONS } from "../../../src/lib/export/pdf-options";
import { PDF_EXPORT_ERROR_CODES } from "../../../src/lib/export/pdf-export-errors";
import {
  PDF_EXPORT_QUOTA_DEFAULT_LIMIT,
  claimPdfExportQuota,
  getPdfExportProblemIds,
  getPdfExportQuotaWindow,
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

describe("PDF export quota", () => {
  it("allows the third PDF export for the same problem in a KST month", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        allowed: true,
        usageIds: ["usage-1"],
        limit: PDF_EXPORT_QUOTA_DEFAULT_LIMIT,
        used: 3,
        remaining: 0,
        resetAt: "2026-08-01T00:00:00+09:00",
        periodUnit: "month",
      },
      error: null,
    }));
    const supabase = {
      rpc,
    };

    await expect(
      claimPdfExportQuota(
        supabase as never,
        "user-1",
        ["problem-2", "problem-1", "problem-2"],
        "33333333-3333-4333-8333-333333333333",
      ),
    ).resolves.toMatchObject({
      usageIds: ["usage-1"],
      limit: 3,
      remaining: 0,
    });
    expect(rpc).toHaveBeenCalledWith("claim_pdf_export_quota", {
      p_user_id: "user-1",
      p_problem_ids: ["problem-1", "problem-2"],
      p_request_id: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("blocks the fourth PDF export for the same problem with stable quota metadata", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({
        data: {
          allowed: false,
          code: "pdf_export_quota_exceeded",
          limit: 3,
          used: 3,
          remaining: 0,
          resetAt: "2026-08-01T00:00:00+09:00",
          periodUnit: "month",
        },
        error: null,
      })),
    };

    await expect(
      claimPdfExportQuota(
        supabase as never,
        "user-1",
        ["problem-1"],
        "33333333-3333-4333-8333-333333333333",
      ),
    ).rejects.toMatchObject({
      status: 429,
      code: "pdf_export_quota_exceeded",
      details: {
        limit: 3,
        used: 3,
        remaining: 0,
        resetAt: "2026-08-01T00:00:00+09:00",
        periodUnit: "month",
      },
    });
  });

  it("calculates day, week, and month windows in Asia/Seoul", () => {
    const now = new Date("2026-07-07T05:30:00.000Z");

    expect(getPdfExportQuotaWindow("day", "Asia/Seoul", now)).toEqual({
      start: "2026-07-07T00:00:00+09:00",
      end: "2026-07-08T00:00:00+09:00",
    });
    expect(getPdfExportQuotaWindow("week", "Asia/Seoul", now)).toEqual({
      start: "2026-07-06T00:00:00+09:00",
      end: "2026-07-13T00:00:00+09:00",
    });
    expect(getPdfExportQuotaWindow("month", "Asia/Seoul", now)).toEqual({
      start: "2026-07-01T00:00:00+09:00",
      end: "2026-08-01T00:00:00+09:00",
    });
  });

  it("extracts distinct problem ids from mixed PDF export items", () => {
    expect(
      getPdfExportProblemIds([
        { kind: "submission", problemId: "problem-1" } as never,
        { kind: "submission", problemId: "problem-1" } as never,
        { kind: "report", problemId: "problem-2" } as never,
      ]),
    ).toEqual(["problem-1", "problem-2"]);
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

  it("builds canonical PDF problem context from its pinned safe snapshot", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce({
      ...failedSubmission(),
      question_no: 54,
      feedback_status: "complete",
      question_snapshot: {
        question_id: "topik-writing-54-0001",
        canonical_import_id: "321",
        payload_hash: "hash-321",
        item_number: 54,
        title: "제출 시점 제목",
        prompt: "제출 시점 문제 지문",
        tags: [],
        materials: {},
      },
    } as never);
    const from = vi.fn(() => {
      throw new Error("canonical snapshot must not query problems");
    });

    await expect(
      resolvePdfExportItems({ from } as never, {
        sourceType: "submission",
        sourceId: "sub-complete",
        options: { ...exportOptions, includeFeedback: false },
      }),
    ).resolves.toMatchObject([
      {
        kind: "submission",
        problemContext: {
          kind: "q54",
          title: "제출 시점 제목",
          prompt: "제출 시점 문제 지문",
        },
      },
    ]);
    expect(from).not.toHaveBeenCalled();
  });

  it("builds legacy PDF problem context only from legacy_cutover_snapshot", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce({
      ...failedSubmission(),
      id: "sub-legacy",
      feedback_status: "complete",
      question_snapshot: null,
      legacy_cutover_snapshot: {
        snapshot_source: "legacy_cutover",
        problem_id: "problem-1",
        item_number: 51,
        title: "보존된 미러 제목",
        prompt: "문장 (ㄱ) 그리고 (ㄴ)",
        tags: [],
        materials: {
          blank_1_role: "도입",
          blank_1_function: "상황 설명",
          blank_1_answer_type: "한 문장",
        },
      },
    } as never);
    const rpc = vi.fn(() => {
      throw new Error("legacy snapshot must not query history or catalog");
    });

    await expect(
      resolvePdfExportItems({ rpc } as never, {
        sourceType: "submission",
        sourceId: "sub-legacy",
        options: { ...exportOptions, includeFeedback: false },
      }),
    ).resolves.toMatchObject([
      {
        kind: "submission",
        problemContext: {
          kind: "q51",
          title: "보존된 미러 제목",
          prompt: "문장 (ㄱ) 그리고 (ㄴ)",
          blankedPrompt: "문장 (ㄱ) 그리고 (ㄴ)",
          blanks: expect.arrayContaining([
            expect.objectContaining({
              role: "도입",
              functionLabel: "상황 설명",
              answerType: "한 문장",
            }),
          ]),
        },
      },
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses an explicit unavailable context when both snapshots are missing", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce({
      ...failedSubmission(),
      id: "sub-without-snapshot",
      feedback_status: "complete",
      question_snapshot: null,
      legacy_cutover_snapshot: null,
    } as never);
    const rpc = vi.fn(() => {
      throw new Error("missing snapshots must not query current data");
    });

    await expect(
      resolvePdfExportItems({ rpc } as never, {
        sourceType: "submission",
        sourceId: "sub-without-snapshot",
        options: { ...exportOptions, includeFeedback: false },
      }),
    ).resolves.toMatchObject([
      {
        kind: "submission",
        problemContext: { kind: "unavailable", questionNo: 51 },
      },
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("projects q53 chart data into a print-safe problem context", async () => {
    vi.mocked(getSubmission).mockResolvedValueOnce({
      ...failedSubmission(),
      id: "sub-q53",
      question_no: 53,
      feedback_status: "complete",
      question_snapshot: {
        item_number: 53,
        title: "온라인 학습 이용률",
        prompt:
          "1) 이용률의 변화를 설명하십시오.\n2) 집단별 차이를 비교하십시오.",
        tags: [],
        materials: {
          charts: {
            chart_a: {
              title: "연도별 이용률",
              chart_type: "bar",
              unit: "%",
              year_range: [2024, 2025],
              series: [{ label: "전체", values: [40, 55] }],
            },
          },
        },
      },
    } as never);

    const [item] = await resolvePdfExportItems({} as never, {
      sourceType: "submission",
      sourceId: "sub-q53",
      options: { ...exportOptions, includeFeedback: false },
    });

    expect(item).toMatchObject({
      kind: "submission",
      problemContext: {
        kind: "q53",
        title: "온라인 학습 이용률",
        writingTasks: [
          "이용률의 변화를 설명하십시오.",
          "집단별 차이를 비교하십시오.",
        ],
        materialCards: [
          {
            kind: "chart",
            chart: {
              title: "연도별 이용률",
              unit: "%",
              series: [{ label: "전체", values: [40, 55] }],
            },
          },
        ],
      },
    });
  });
});
