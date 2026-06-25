import { describe, expect, it } from "vitest";

import {
  isDashboardContinueDraftCandidate,
  pickDashboardContinueDraft,
  type DashboardContinueDraftQueryRow,
} from "../../../src/lib/writing/dashboard-drafts";

function draft(
  overrides: Partial<DashboardContinueDraftQueryRow> = {},
): DashboardContinueDraftQueryRow {
  return {
    problem_id: "problem-1",
    question_no: 51,
    answer_text: "ㄱ: 실제 답안",
    answer_json: { _v: "51.v1", blanks: { "ㄱ": "실제 답안" } },
    char_count: 5,
    autosave_status: "clean",
    last_saved_at: "2026-06-24T08:53:33.067Z",
    updated_at: "2026-06-24T08:53:33.067Z",
    problems: { title: "작성 중인 문제", question_no: 51 },
    ...overrides,
  };
}

describe("dashboard continue draft candidate", () => {
  it("rejects a whitespace-only draft even when char_count is positive", () => {
    expect(
      isDashboardContinueDraftCandidate(
        draft({
          answer_text: " \n\t ",
          answer_json: { _v: "51.v1", blanks: { "ㄱ": " ", "ㄴ": "" } },
          char_count: 3,
        }),
      ),
    ).toBe(false);
  });

  it("rejects empty short-answer blanks", () => {
    expect(
      isDashboardContinueDraftCandidate(
        draft({
          answer_text: "",
          answer_json: { _v: "52.v1", blanks: { "ㄱ": "", "ㄴ": " " } },
          char_count: 1,
          question_no: 52,
          problems: { title: "52번 문제", question_no: 52 },
        }),
      ),
    ).toBe(false);
  });

  it("rejects empty long-form sections and essay text", () => {
    expect(
      isDashboardContinueDraftCandidate(
        draft({
          question_no: 53,
          answer_text: "",
          answer_json: {
            _v: "53.v1",
            sections: { intro: "", body: " ", conclusion: "" },
          },
          char_count: 1,
          problems: { title: "53번 문제", question_no: 53 },
        }),
      ),
    ).toBe(false);

    expect(
      isDashboardContinueDraftCandidate(
        draft({
          question_no: 54,
          answer_text: "",
          answer_json: {
            _v: "54.v1",
            text: " ",
            checklist: {
              intro: "unchecked",
              body: "unchecked",
              conclusion: "unchecked",
              evidence: "unchecked",
              connectors: "unchecked",
              topic_fit: "unchecked",
            },
          },
          char_count: 1,
          problems: { title: "54번 문제", question_no: 54 },
        }),
      ),
    ).toBe(false);
  });

  it("accepts a draft with meaningful answer_json content even if answer_text is missing", () => {
    expect(
      isDashboardContinueDraftCandidate(
        draft({
          question_no: 51,
          answer_text: "",
          answer_json: { _v: "51.v1", blanks: { "ㄱ": "기숙사를 바꾸고 싶습니다" } },
          char_count: 0,
        }),
      ),
    ).toBe(true);
  });

  it("rejects superseded drafts before mapping to the dashboard card", () => {
    expect(
      pickDashboardContinueDraft([
        draft({
          problem_id: "superseded-draft",
          autosave_status: "superseded",
          answer_text: "이미 제출된 답안",
        }),
      ]),
    ).toBeNull();
  });

  it("skips the newest empty draft and maps the newest meaningful draft", () => {
    const selected = pickDashboardContinueDraft([
      draft({
        problem_id: "empty-latest",
        answer_text: " ",
        answer_json: { _v: "51.v1", blanks: { "ㄱ": " " } },
        char_count: 1,
        last_saved_at: "2026-06-25T09:00:00.000Z",
        updated_at: "2026-06-25T09:00:00.000Z",
        problems: { title: "빈 draft", question_no: 51 },
      }),
      draft({
        problem_id: "meaningful-older",
        question_no: null,
        answer_text: "ㄱ: 실제로 작성한 답안",
        answer_json: { _v: "51.v1", blanks: { "ㄱ": "실제로 작성한 답안" } },
        char_count: 10,
        last_saved_at: "2026-06-24T09:00:00.000Z",
        updated_at: "2026-06-24T09:00:00.000Z",
        problems: { title: "실제 작성 문제", question_no: 51 },
      }),
    ]);

    expect(selected).toEqual({
      problemId: "meaningful-older",
      title: "실제 작성 문제",
      questionNo: 51,
      lastSavedAt: "2026-06-24T09:00:00.000Z",
    });
  });
});
