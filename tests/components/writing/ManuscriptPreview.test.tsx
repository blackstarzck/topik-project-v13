// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ManuscriptPreview } from "../../../src/components/writing/ManuscriptPreview";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

describe("ManuscriptPreview", () => {
  it("owns its outer layout and header without a global CSS dependency", () => {
    const modulePath = join(
      process.cwd(),
      "src/components/writing/ManuscriptPreview.module.css",
    );
    const source = readFileSync(
      join(process.cwd(), "src/components/writing/ManuscriptPreview.tsx"),
      "utf8",
    );
    const globalCss = readFileSync(
      join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect(existsSync(modulePath)).toBe(true);
    if (!existsSync(modulePath)) return;

    expect(readFileSync(modulePath, "utf8").trim()).toBe(`.preview {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 8px;
}

.compact {
  grid-template-rows: minmax(0, 1fr);
}

.title:global(.ant-typography) {
  margin: 0;
}

.meta:global(.ant-typography) {
  display: block;
}`);
    expect(source).toContain(
      'import styles from "./ManuscriptPreview.module.css";',
    );
    expect(source).toMatch(/"writing-manuscript-preview",\s*styles\.preview/u);
    expect(source).toContain('!showHeader ? styles.compact : ""');
    expect(source).toMatch(
      /"writing-manuscript-preview__title",\s*styles\.title/u,
    );
    expect(source).toMatch(
      /"writing-manuscript-preview__meta",\s*styles\.meta/u,
    );
    expect(globalCss).not.toMatch(
      /\.writing-manuscript-preview(?:--compact|__(?:title|meta)\.ant-typography)?\s*\{/u,
    );
  });

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
