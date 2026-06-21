// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { ExamGoalForm } from "../../../src/components/profile/ExamGoalForm";
import koMessages from "../../../messages/ko.json";

afterEach(() => cleanup());

// ExamGoalForm calls useTranslations (next-intl) + App.useApp() (antd), so it must
// render inside both providers, against the real ko catalog.
function renderForm(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

describe("ExamGoalForm", () => {
  it("renders the goal form directly — no card title, no view step", () => {
    renderForm(<ExamGoalForm userId="user-1" goal={null} />);
    // 카드 타이틀('목표 시험')과 보기 단계의 링크는 더 이상 없다.
    expect(screen.queryByText("목표 시험")).toBeNull();
    expect(
      screen.queryByText("주당 학습 시간·취약 영역까지 변경하기"),
    ).toBeNull();
    // 폼 필드와 저장/취소 버튼이 기본 노출된다.
    expect(screen.getByLabelText("목표 등급")).toBeTruthy();
    expect(screen.getByRole("button", { name: "저장" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("defaults to TOPIK II / 4급 when no goal exists", () => {
    renderForm(<ExamGoalForm userId="user-1" goal={null} />);
    expect(screen.getByText("TOPIK II (3-6급)")).toBeTruthy();
    const grade = screen.getByLabelText("목표 등급") as HTMLInputElement;
    expect(grade.value).toBe("4");
  });

  it("hydrates fields from an existing goal", () => {
    renderForm(
      <ExamGoalForm
        userId="user-1"
        goal={{
          topik_level: "TOPIK_I",
          target_grade: 2,
          exam_date: "2026-10-15",
        }}
      />,
    );
    expect(screen.getByText("TOPIK I (1-2급)")).toBeTruthy();
    const grade = screen.getByLabelText("목표 등급") as HTMLInputElement;
    expect(grade.value).toBe("2");
  });

  it("disables 저장 when no userId is provided (read-only)", () => {
    renderForm(<ExamGoalForm goal={null} />);
    const save = screen.getByRole("button", { name: "저장" });
    expect(save.hasAttribute("disabled")).toBe(true);
  });
});
