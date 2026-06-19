// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WritingGuideAccordion } from "../../../src/components/writing/WritingGuideAccordion";

describe("WritingGuideAccordion", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables failed guide panels and prevents expansion", () => {
    renderWithIntl(
      <WritingGuideAccordion
        loadFailed
        loadFailedLabel="불러오기 실패"
        defaultActiveKeys={["guide"]}
        items={[
          {
            key: "guide",
            title: "조건 점검",
            disabledOnLoadFailed: true,
            children: <div data-testid="guide-body">조건 내용</div>,
          },
        ]}
      />,
    );

    expect(screen.queryByTestId("guide-body")).toBeNull();
    expect(screen.getByText("불러오기 실패")).toBeTruthy();

    fireEvent.click(screen.getByText("조건 점검"));

    expect(screen.queryByTestId("guide-body")).toBeNull();
  });

  it("renders active guide content when loading succeeds", () => {
    renderWithIntl(
      <WritingGuideAccordion
        loadFailed={false}
        loadFailedLabel="불러오기 실패"
        defaultActiveKeys={["guide"]}
        items={[
          {
            key: "guide",
            title: "조건 점검",
            disabledOnLoadFailed: true,
            children: <div data-testid="guide-body">조건 내용</div>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("guide-body").textContent).toBe("조건 내용");
    expect(screen.queryByText("불러오기 실패")).toBeNull();
  });
});
