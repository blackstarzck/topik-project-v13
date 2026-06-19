// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { EssayStructureGuide } from "../../../src/components/writing/EssayStructureGuide";
import type { NormalizedEssayGuidance } from "../../../src/lib/writing/problem-normalizer";

afterEach(() => cleanup());

describe("EssayStructureGuide", () => {
  it("renders DB-driven q54 writing guidance as an accordion, not tri-state self checks", () => {
    const guidance: NormalizedEssayGuidance = {
      structure: [
        {
          id: "intro",
          title: "서론",
          description:
            "주제에 대한 자신의 의견을 명확히 밝히고 글의 방향을 제시하세요.",
          items: [],
          required: true,
        },
        {
          id: "body",
          title: "본론",
          description:
            "의견을 뒷받침하는 구체적 이유나 사례를 2가지 이상 제시하세요.",
          items: ["본론 1: 첫 번째 근거/사례", "본론 2: 두 번째 근거/사례"],
          required: true,
        },
        {
          id: "conclusion",
          title: "결론",
          description:
            "앞서 제시한 내용을 요약하고 자신의 의견을 다시 강조하세요.",
          items: [],
          required: true,
        },
      ],
      reasonCount: 2,
      reasoningPattern: "주장→근거",
      scoringFocus: ["의견 제시", "구체적 근거", "문장 연결", "분량"],
      prohibitedElements: ["주제 이탈"],
      modelOutline: [
        {
          id: "outline-intro",
          title: "서론",
          description: null,
          items: ["입장 제시"],
          required: false,
        },
      ],
    };

    const { container } = renderWithIntl(
      <EssayStructureGuide
        guidance={guidance}
        loadFailed={false}
        loadFailedLabel="불러오기 실패"
      />,
    );

    expect(screen.getByTestId("q54-guidance-accordion")).toBeTruthy();
    expect(screen.getByText("글의 구조 제안")).toBeTruthy();
    expect(screen.getByText("작성 체크 포인트")).toBeTruthy();
    expect(screen.getByText("서론")).toBeTruthy();
    expect(screen.getByText("본론")).toBeTruthy();
    expect(screen.getByText("본론 1: 첫 번째 근거/사례")).toBeTruthy();
    expect(screen.getByText("근거 2개 이상")).toBeTruthy();
    expect(screen.getByText("전개 방식: 주장→근거")).toBeTruthy();
    expect(screen.getByText("의견 제시")).toBeTruthy();
    expect(screen.queryByText("아직")).toBeNull();
    expect(screen.queryByText("부분")).toBeNull();
    expect(screen.queryByText("완료")).toBeNull();
    expect(container.querySelector(".border-b")).toBeNull();
  });
});
