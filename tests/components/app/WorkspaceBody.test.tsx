// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";

import {
  WorkspaceBody,
  WorkspaceFixedActionBar,
  type WorkspaceBodySize,
} from "../../../src/components/app/WorkspaceBody";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const WORKSPACE_LAYOUT_CSS = readFileSync(
  join(process.cwd(), "src/styles/workspace-layout.css"),
  "utf8",
);

const SIZES: WorkspaceBodySize[] = [
  "form",
  "task",
  "workspace",
  "wide",
  "full",
];

afterEach(() => {
  cleanup();
});

describe("WorkspaceBody", () => {
  it("renders the default workspace body as a div, not a landmark", () => {
    const { container } = renderWithIntl(
      <WorkspaceBody className="custom-body-class">
        <span>workspace body</span>
      </WorkspaceBody>,
    );

    const body = screen.getByTestId("workspace-page-body");
    expect(body.tagName).toBe("DIV");
    expect(body.getAttribute("data-workspace-body-size")).toBe("workspace");
    expect(body.classList.contains("app-workspace-body")).toBe(true);
    expect(body.classList.contains("app-workspace-body--workspace")).toBe(true);
    expect(body.classList.contains("app-workspace-body--page")).toBe(true);
    expect(body.classList.contains("custom-body-class")).toBe(true);
    expect(container.querySelector("main")).toBeNull();
  });

  it("preserves a caller test id and only defaults it when omitted", () => {
    const { rerender } = renderWithIntl(
      <WorkspaceBody data-testid="custom-workspace-body">
        <span>custom id</span>
      </WorkspaceBody>,
    );

    expect(screen.getByTestId("custom-workspace-body")).toBeTruthy();
    expect(screen.queryByTestId("workspace-page-body")).toBeNull();

    rerender(
      <WorkspaceBody>
        <span>default id</span>
      </WorkspaceBody>,
    );

    expect(screen.getByTestId("workspace-page-body")).toBeTruthy();
  });

  it("keeps page layout styles on the semantic hook instead of the test id", () => {
    expect(WORKSPACE_LAYOUT_CSS).not.toContain("workspace-page-body");
    expect(
      WORKSPACE_LAYOUT_CSS.match(/\.app-workspace-body--page(?=[\s{])/gu),
    ).toHaveLength(3);
  });

  it.each(SIZES)("applies the %s size contract", (size) => {
    renderWithIntl(
      <WorkspaceBody size={size}>
        <span>{size}</span>
      </WorkspaceBody>,
    );

    const body = screen.getByTestId("workspace-page-body");
    expect(body.getAttribute("data-workspace-body-size")).toBe(size);
    expect(body.classList.contains(`app-workspace-body--${size}`)).toBe(true);
  });
});

describe("WorkspaceFixedActionBar", () => {
  it("keeps the fixed root separate from the aligned inner body", () => {
    const { container } = renderWithIntl(
      <WorkspaceFixedActionBar
        data-testid="next-selection-bar"
        size="task"
        className="custom-fixed-root"
        innerClassName="custom-fixed-inner"
      >
        <span>Selected problem</span>
      </WorkspaceFixedActionBar>,
    );

    const root = screen.getByTestId("next-selection-bar");
    const inner = container.querySelector(
      ".app-workspace-fixed-action-bar__inner",
    );

    expect(root.classList.contains("app-workspace-fixed-action-bar")).toBe(
      true,
    );
    expect(root.classList.contains("custom-fixed-root")).toBe(true);
    expect(inner).toBeTruthy();
    expect(inner?.getAttribute("data-workspace-body-size")).toBe("task");
    expect(inner?.classList.contains("app-workspace-body")).toBe(true);
    expect(inner?.classList.contains("app-workspace-body--task")).toBe(true);
    expect(inner?.classList.contains("custom-fixed-inner")).toBe(true);
    expect(root.classList.contains("app-workspace-body--page")).toBe(false);
    expect(inner?.classList.contains("app-workspace-body--page")).toBe(false);
  });
});
