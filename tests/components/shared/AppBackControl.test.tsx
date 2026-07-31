// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    replace,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    replace?: boolean;
  }) => (
    <a {...props} data-replace={replace ? "true" : "false"}>
      {children}
    </a>
  ),
}));

import { AppBackControl } from "../../../src/components/shared/AppBackControl";

afterEach(() => cleanup());

describe("AppBackControl", () => {
  it("renders semantic back links with replace navigation", () => {
    render(
      <AppBackControl
        href="/library"
        label="Back to library"
        testId="back-link"
      />,
    );

    const link = screen.getByTestId("back-link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/library");
    expect(link.getAttribute("aria-label")).toBe("Back to library");
    expect(link.getAttribute("data-replace")).toBe("true");
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders guarded semantic back actions as buttons", () => {
    const onClick = vi.fn();
    render(
      <AppBackControl
        onClick={onClick}
        label="Back to previous screen"
        testId="back-button"
      />,
    );

    const button = screen.getByTestId("back-button");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
