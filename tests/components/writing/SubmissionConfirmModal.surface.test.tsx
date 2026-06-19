// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { SubmissionConfirmModal } from "../../../src/components/writing/SubmissionConfirmModal";

beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => cleanup());

function renderModal() {
  renderWithIntl(
    <SubmissionConfirmModal
      open
      charCount={650}
      minChars={600}
      questionNo={54}
      lastSavedAt={null}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  return screen.getByTestId("submission-confirm-modal");
}

describe("SubmissionConfirmModal content surfaces", () => {
  it("omits summary, warning, checklist, agreement, footer note, and top icon content", () => {
    const modal = renderModal();

    expect(modal.querySelector("section")).toBeNull();
    expect(modal.querySelector("label")).toBeNull();
    expect(modal.querySelector(".ant-checkbox")).toBeNull();
    expect(modal.querySelector(".lucide-clipboard-check")).toBeNull();
    expect(modal.querySelector(".lucide-shield-check")).toBeNull();
  });

  it("enables submit without agreement and makes submit wider than cancel", () => {
    renderModal();

    expect(
      (screen.getByTestId("submission-confirm-submit") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      screen
        .getByTestId("submission-confirm-cancel")
        .parentElement?.classList.contains("grid-cols-[2fr_3fr]"),
    ).toBe(true);
  });

  it("separates copy from actions with a large vertical gap", () => {
    renderModal();

    expect(
      screen
        .getByTestId("submission-confirm-cancel")
        .parentElement?.classList.contains("mt-8"),
    ).toBe(true);
  });

  it("does not render content-specific borders, radii, or backgrounds", () => {
    const modal = renderModal();
    const decoratedContentClasses = Array.from(
      modal.querySelectorAll("div, section, label, span"),
    )
      .filter((element) => !element.closest(".ant-checkbox"))
      .flatMap((element) => Array.from(element.classList));

    expect(
      decoratedContentClasses.filter(
        (className) =>
          className === "border" ||
          className.startsWith("border-") ||
          className.startsWith("rounded") ||
          className === "bg-background" ||
          className === "bg-surface" ||
          className.startsWith("bg-"),
      ),
    ).toEqual([]);
  });
});
