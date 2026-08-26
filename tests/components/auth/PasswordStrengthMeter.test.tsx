// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordStrengthMeter } from "../../../src/components/auth/PasswordStrengthMeter";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(cleanup);

const cases = [
  { password: "abcdefgh", label: "약함", score: 1, role: "status-error" },
  { password: "abcdefghijkl", label: "보통", score: 2, role: "status-warning" },
  { password: "abcdefgh1234", label: "양호", score: 3, role: "status-success" },
  {
    password: "Abcdefgh123!",
    label: "강함",
    score: 4,
    role: "status-strong-success",
  },
] as const;

describe("PasswordStrengthMeter", () => {
  it.each(cases)(
    "keeps the four-step $label state on semantic theme classes",
    ({ password, label, score, role }) => {
      renderWithIntl(<PasswordStrengthMeter password={password} />);

      const meter = screen.getByTestId("password-strength");
      const segments = Array.from(meter.firstElementChild?.children ?? []);
      const filled = segments.filter((segment) =>
        segment.classList.contains(`bg-${role}`),
      );

      expect(segments).toHaveLength(4);
      expect(filled).toHaveLength(score);
      expect(
        segments.every((segment) =>
          segment.classList.contains("rounded-indicator"),
        ),
      ).toBe(true);
      expect(
        segments
          .slice(score)
          .every((segment) => segment.classList.contains("bg-fill-secondary")),
      ).toBe(true);
      expect(screen.getByText(`비밀번호 강도: ${label}`).className).toContain(
        `!text-${role}`,
      );
    },
  );

  it("keeps rule meaning visible while using the semantic success role", () => {
    renderWithIntl(<PasswordStrengthMeter password="Abcdefgh123!" />);

    expect(screen.getByText("✓ 8자 이상").className).toContain(
      "text-status-success",
    );
    expect(
      screen.getByTestId("password-strength").getAttribute("aria-live"),
    ).toBe("polite");
  });

  it("still hides an empty meter unless the caller opts in", () => {
    renderWithIntl(<PasswordStrengthMeter password="" />);
    expect(screen.queryByTestId("password-strength")).toBeNull();

    cleanup();
    renderWithIntl(<PasswordStrengthMeter password="" showWhenEmpty />);
    expect(screen.getByTestId("password-strength")).toBeTruthy();
  });
});
