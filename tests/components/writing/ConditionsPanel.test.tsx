// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { ConditionsPanel } from "../../../src/components/writing/ConditionsPanel";

afterEach(() => cleanup());

describe("ConditionsPanel", () => {
  it("renders q53 criteria as a single evaluation card body without a duplicate heading", () => {
    renderWithIntl(
      <ConditionsPanel
        questionNo={53}
        rubric={{
          criteria: [
            "내용: 자료의 핵심 변화",
            "구성: 도입-전개-마무리",
            "언어: 정확한 문법과 표현",
          ],
        }}
      />,
    );

    expect(screen.getAllByText("평가 기준")).toHaveLength(1);

    const contentCriterion = screen.getByText("내용: 자료의 핵심 변화");
    const structureCriterion = screen.getByText("구성: 도입-전개-마무리");
    const languageCriterion = screen.getByText("언어: 정확한 문법과 표현");
    const list = contentCriterion.closest("ul");

    expect(list).not.toBeNull();
    expect(list?.classList.contains("writing-guide-list")).toBe(true);
    expect(list?.classList.contains("writing-guide-list--examples")).toBe(true);
    expect(list?.contains(structureCriterion.closest("li"))).toBe(true);
    expect(list?.contains(languageCriterion.closest("li"))).toBe(true);
  });

  it("renders q54 criteria with the same single evaluation card treatment as q53", () => {
    renderWithIntl(
      <ConditionsPanel
        questionNo={54}
        rubric={{
          criteria: [
            "내용: 주어진 세 가지 과제",
            "구성: 도입-전개-마무리",
            "언어: 격식체와 정확한 표현",
          ],
        }}
      />,
    );

    expect(screen.getAllByText("평가 기준")).toHaveLength(1);
    expect(screen.queryByText("조건 · 루브릭")).toBeNull();

    const contentCriterion = screen.getByText("내용: 주어진 세 가지 과제");
    const structureCriterion = screen.getByText("구성: 도입-전개-마무리");
    const languageCriterion = screen.getByText("언어: 격식체와 정확한 표현");
    const list = contentCriterion.closest("ul");

    expect(list).not.toBeNull();
    expect(list?.classList.contains("writing-guide-list")).toBe(true);
    expect(list?.classList.contains("writing-guide-list--examples")).toBe(true);
    expect(list?.contains(structureCriterion.closest("li"))).toBe(true);
    expect(list?.contains(languageCriterion.closest("li"))).toBe(true);
  });

  it("keeps q52 condition cards capped at four items", () => {
    renderWithIntl(
      <ConditionsPanel
        questionNo={52}
        rubric={{
          conditions: ["조건 1", "조건 2", "조건 3", "조건 4", "조건 5"],
        }}
      />,
    );

    expect(screen.getByText("조건 1")).toBeTruthy();
    expect(screen.getByText("조건 4")).toBeTruthy();
    expect(screen.queryByText("조건 5")).toBeNull();
  });

  it("allows q54 condition cards to show up to five items", () => {
    renderWithIntl(
      <ConditionsPanel
        questionNo={54}
        rubric={{
          conditions: [
            "조건 1",
            "조건 2",
            "조건 3",
            "조건 4",
            "조건 5",
            "조건 6",
          ],
        }}
      />,
    );

    expect(screen.getByText("조건 1")).toBeTruthy();
    expect(screen.getByText("조건 5")).toBeTruthy();
    expect(screen.queryByText("조건 6")).toBeNull();
  });
});
