// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ManuscriptPreview } from "../../../src/components/writing/ManuscriptPreview";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

describe("ManuscriptPreview", () => {
  it("marks each filled cell with its writing section and highlights the active section", () => {
    renderWithIntl(
      <ManuscriptPreview
        text="ABC"
        cellSections={["intro", "body", "conclusion"]}
        activeSection="body"
        sectionLabels={{
          intro: "도입",
          body: "전개",
          conclusion: "마무리",
        }}
      />,
    );

    const cells = screen.getAllByTestId("manuscript-preview-cell");

    expect(cells[0]?.textContent).toBe("A");
    expect(cells[0]?.getAttribute("data-section")).toBe("intro");
    expect(cells[0]?.getAttribute("data-highlighted")).toBe("false");

    expect(cells[1]?.textContent).toBe("B");
    expect(cells[1]?.getAttribute("data-section")).toBe("body");
    expect(cells[1]?.getAttribute("data-highlighted")).toBe("true");
    expect(
      cells[1]?.classList.contains(
        "writing-manuscript-preview__cell--highlighted",
      ),
    ).toBe(true);
    expect(cells[1]?.getAttribute("aria-label")).toBe("전개 B");

    expect(cells[2]?.textContent).toBe("C");
    expect(cells[2]?.getAttribute("data-section")).toBe("conclusion");
    expect(cells[2]?.getAttribute("data-highlighted")).toBe("false");
  });
});
