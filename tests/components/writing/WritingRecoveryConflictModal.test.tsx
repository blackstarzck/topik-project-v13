// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { WritingRecoveryConflictModal } from "../../../src/components/writing/WritingRecoveryConflictModal";
import type { WritingRecoveryConflict } from "../../../src/lib/writing/writing-resilience";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

const conflict: WritingRecoveryConflict = {
  current: {
    draft: {
      answer_json: { text: "current-secret" },
      answer_text: "current-secret",
      autosave_status: "clean",
      canonical_import_id: 701,
      canonical_payload_hash: "hash",
      canonical_question_id: "question-54",
      char_count: 14,
      last_saved_at: "2026-07-18T01:00:00.000Z",
      problem_id: "problem-1",
      question_no: 54,
      user_id: "user-1",
    },
    draftId: "draft-1",
  },
  currentDirty: false,
  currentSavedAt: "2026-07-18T01:00:00.000Z",
  prior: {
    answerJson: { text: "prior-secret" },
    answerText: "prior-secret",
    canonicalQuestionId: "question-54",
    draftId: "draft-1",
    expiresAt: "2026-07-19T00:00:00.000Z",
    firstStoredAt: "2026-07-18T00:00:00.000Z",
    importId: "701",
    key: "user-1:problem-1:54",
    payloadHash: "hash",
    problemId: "problem-1",
    questionNo: 54,
    retention: "default",
    savedAt: "2026-07-18T00:00:00.000Z",
    schemaVersion: 1,
    userId: "user-1",
  },
  priorSavedAt: "2026-07-18T00:00:00.000Z",
};

describe("WritingRecoveryConflictModal", () => {
  it("shows only localized timestamps and requires an explicit prior/current choice", () => {
    const onChoose = vi.fn();
    renderWithIntl(
      <WritingRecoveryConflictModal conflict={conflict} onChoose={onChoose} />,
    );

    expect(screen.getByText("이전에 작성한 내용")).toBeTruthy();
    expect(screen.getByText("현재 저장된 내용")).toBeTruthy();
    expect(
      screen.getByTestId("writing-recovery-prior-time").textContent,
    ).toContain("2026");
    expect(
      screen.getByTestId("writing-recovery-current-time").textContent,
    ).toContain("2026");
    expect(document.body.textContent).not.toContain("prior-secret");
    expect(document.body.textContent).not.toContain("current-secret");

    fireEvent.click(screen.getByTestId("writing-recovery-choose-prior"));
    fireEvent.click(screen.getByTestId("writing-recovery-choose-current"));
    expect(onChoose).toHaveBeenNthCalledWith(1, "prior");
    expect(onChoose).toHaveBeenNthCalledWith(2, "current");
  });

  it("renders nothing without a conflict", () => {
    const { container } = renderWithIntl(
      <WritingRecoveryConflictModal conflict={null} onChoose={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("labels a dirty current-tab choice as unsaved instead of server-saved", () => {
    renderWithIntl(
      <WritingRecoveryConflictModal
        conflict={{ ...conflict, currentDirty: true }}
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByText("현재 작성 중인 내용")).toBeTruthy();
    expect(
      screen.getByTestId("writing-recovery-current-time").textContent,
    ).toBe("아직 저장되지 않음");
    expect(
      screen.getByTestId("writing-recovery-choose-current").textContent,
    ).toBe("현재 내용 사용");
    expect(screen.queryByText("현재 저장된 내용")).toBeNull();
  });
});
