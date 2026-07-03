import { beforeEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  getComparisonReport: vi.fn(),
  getComparisonTargetCandidates: vi.fn(),
  getFeedbackBundle: vi.fn(),
  getSubmission: vi.fn(),
  getWritingProblemAvailability: vi.fn(),
}));

vi.mock("@/lib/writing/server", () => serverMocks);

describe("getComparisonReportViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMocks.getComparisonReport.mockResolvedValue({
      id: "report-1",
      current_submission_id: "submission-1",
      previous_submission_id: null,
      metrics: {
        score_delta: null,
        dimension_deltas: {},
        char_delta: null,
        no_previous: true,
      },
      narrative: null,
    });
    serverMocks.getSubmission.mockResolvedValue({
      id: "submission-1",
      problem_id: "00000000-0000-0000-0000-000000000051",
      question_no: 51,
      answer_text: "answer",
      answer_json: null,
      char_count: 18,
      submitted_at: "2026-07-01T06:00:00.000Z",
    });
    serverMocks.getFeedbackBundle.mockResolvedValue(null);
    serverMocks.getComparisonTargetCandidates.mockResolvedValue([]);
    serverMocks.getWritingProblemAvailability.mockResolvedValue({
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: null,
    });
  });

  it("omits retry navigation when the current problem is no longer visible to the caller", async () => {
    const { getComparisonReportViewModel } =
      await import("../../../src/lib/writing/comparison-report-view-model");

    const viewModel = await getComparisonReportViewModel("report-1");

    expect(viewModel?.retryHref).toBeNull();
    expect(serverMocks.getWritingProblemAvailability).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000051",
    );
  });
});
