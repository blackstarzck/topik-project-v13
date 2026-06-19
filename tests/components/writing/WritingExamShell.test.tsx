// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WritingExamShell } from "../../../src/components/writing/WritingExamShell";

describe("WritingExamShell", () => {
  it("delegates the header back action to the writing exit guard", () => {
    const onRequestBack = vi.fn();
    const { container } = renderWithIntl(
      <WritingExamShell
        title="52번 설명문 빈칸"
        subtitle="조건을 확인하고 답안을 작성하세요."
        progressPercent={10}
        elapsedSeconds={65}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={onRequestBack}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    const back = container.querySelector(".writing-exam-header__back");
    expect(back).toBeTruthy();

    fireEvent.click(back as Element);

    expect(onRequestBack).toHaveBeenCalledTimes(1);
  });
});
