// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ExamInfoCard } from "../../../src/components/profile/ExamInfoCard";

afterEach(() => cleanup());

describe("ExamInfoCard (Phase 7-E Task 10)", () => {
  it("renders empty state with link to onboarding when goal is null", () => {
    render(<ExamInfoCard goal={null} />);
    expect(screen.getByText("아직 목표를 설정하지 않았어요.")).toBeTruthy();
    const link = screen.getByText("목표 설정하기");
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "/onboarding/learning-goal",
    );
  });

  it("renders TOPIK II + target grade + exam date when goal exists", () => {
    render(
      <ExamInfoCard
        goal={{
          topik_level: "TOPIK_II",
          target_grade: 4,
          exam_date: "2026-10-15",
        }}
      />,
    );
    expect(screen.getByText("TOPIK II")).toBeTruthy();
    expect(screen.getByText(/목표 4급/)).toBeTruthy();
    // toLocaleDateString may render variably; assert by partial match
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it("falls back gracefully when exam_date is null", () => {
    render(
      <ExamInfoCard
        goal={{
          topik_level: "TOPIK_I",
          target_grade: 2,
          exam_date: null,
        }}
      />,
    );
    expect(screen.getByText("시험일이 설정되지 않았습니다.")).toBeTruthy();
  });
});
