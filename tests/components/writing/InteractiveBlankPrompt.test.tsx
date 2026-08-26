// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { InteractiveBlankPrompt } from "../../../src/components/writing/InteractiveBlankPrompt";
import blankStyles from "../../../src/components/writing/InteractiveBlankPrompt.module.css";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { hasStableAndScopedClasses } from "./writing-style-contract";

afterEach(() => cleanup());

describe("InteractiveBlankPrompt", () => {
  it("uses textType instead of the question number prefix in the prompt title", () => {
    renderWithIntl(
      <InteractiveBlankPrompt
        title="Gym satisfaction survey"
        textType="Survey notice"
        questionNo={51}
        prompt="Please answer ( ㄱ )."
        blanks={[{ key: "ㄱ", label: "ㄱ", filled: false }]}
        activeBlankIndex={0}
        onSelectBlank={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Survey notice - Gym satisfaction survey",
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/51/)).toBeNull();
  });

  it("falls back to the problem title without a question number prefix", () => {
    renderWithIntl(
      <InteractiveBlankPrompt
        title="Gym satisfaction survey"
        questionNo={52}
        prompt="Please answer ( ㄱ )."
        blanks={[{ key: "ㄱ", label: "ㄱ", filled: false }]}
        activeBlankIndex={0}
        onSelectBlank={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Gym satisfaction survey",
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/52/)).toBeNull();
  });

  it("activates the matching blank when an inline blank is clicked", () => {
    const onSelectBlank = vi.fn();

    renderWithIntl(
      <InteractiveBlankPrompt
        title="취업 서류 작성 특강 안내"
        questionNo={51}
        prompt="안녕하세요.\n이번 특강에 (ㄱ) 이번 주 수요일까지 신청해 주시기를 바랍니다. 궁금한 점이 있으면 담당자에게 ( ㄴ )."
        blanks={[
          { key: "ㄱ", label: "ㄱ", filled: true },
          { key: "ㄴ", label: "ㄴ", filled: false },
        ]}
        activeBlankIndex={0}
        onSelectBlank={onSelectBlank}
      />,
    );

    const nieunBlank = screen.getByRole("button", { name: /빈칸 ㄴ/ });
    fireEvent.click(nieunBlank);

    expect(onSelectBlank).toHaveBeenCalledWith(1);
  });

  it("marks the active inline blank with aria-pressed", () => {
    renderWithIntl(
      <InteractiveBlankPrompt
        title="취업 서류 작성 특강 안내"
        questionNo={51}
        prompt="안녕하세요. (ㄱ) 입니다. (ㄴ) 주세요."
        blanks={[
          { key: "ㄱ", label: "ㄱ", filled: false },
          { key: "ㄴ", label: "ㄴ", filled: false },
        ]}
        activeBlankIndex={1}
        onSelectBlank={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: /빈칸 ㄴ/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /빈칸 ㄱ/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("pairs stable and scoped classes for base, active, and filled blanks", () => {
    renderWithIntl(
      <InteractiveBlankPrompt
        title="취업 서류 작성 특강 안내"
        questionNo={51}
        prompt="(ㄱ) (ㄴ) (ㄷ)"
        blanks={[
          { key: "ㄱ", label: "ㄱ", filled: false },
          { key: "ㄴ", label: "ㄴ", filled: true },
          { key: "ㄷ", label: "ㄷ", filled: false },
        ]}
        activeBlankIndex={0}
        onSelectBlank={vi.fn()}
      />,
    );

    const active = screen.getByRole("button", { name: /빈칸 ㄱ/ });
    const filled = screen.getByRole("button", { name: /빈칸 ㄴ/ });
    const base = screen.getByRole("button", { name: /빈칸 ㄷ/ });

    for (const blank of [active, filled, base]) {
      expect(
        hasStableAndScopedClasses(
          blank,
          "writing-inline-blank",
          blankStyles.blank,
        ),
      ).toBe(true);
    }
    expect(
      hasStableAndScopedClasses(
        active,
        "writing-inline-blank--active",
        blankStyles.active,
      ),
    ).toBe(true);
    expect(active.getAttribute("aria-pressed")).toBe("true");
    expect(
      hasStableAndScopedClasses(
        filled,
        "writing-inline-blank--filled",
        blankStyles.filled,
      ),
    ).toBe(true);
    expect(filled.getAttribute("aria-pressed")).toBe("false");
    expect(base.getAttribute("aria-pressed")).toBe("false");
    expect(base.classList.contains("writing-inline-blank--active")).toBe(false);
    expect(base.classList.contains("writing-inline-blank--filled")).toBe(false);
  });
});
