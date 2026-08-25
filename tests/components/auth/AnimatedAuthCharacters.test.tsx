// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { collectUiSources } from "../../../scripts/check-ui-contract.mjs";
import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";
import { AnimatedAuthCharacters } from "../../../src/components/auth/AnimatedAuthCharacters";

const motionPropertyNames = ["--lean", "--look-x", "--look-y"] as const;

function expectMotion(
  stage: HTMLElement,
  expected: Record<(typeof motionPropertyNames)[number], string>,
) {
  expect(Array.from(stage.style).sort()).toEqual([...motionPropertyNames]);
  for (const propertyName of motionPropertyNames) {
    expect(stage.style.getPropertyValue(propertyName)).toBe(
      expected[propertyName],
    );
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnimatedAuthCharacters", () => {
  it("keeps the inline runtime motion contract on the stage only", () => {
    const { container } = render(
      <AnimatedAuthCharacters ariaLabel="움직이는 인증 캐릭터" />,
    );
    const stage = screen.getByRole("img", {
      name: "움직이는 인증 캐릭터",
    });

    expect(container.querySelectorAll("[style]")).toHaveLength(1);
    expect(container.querySelector("[style]")).toBe(stage);
    expectMotion(stage, {
      "--look-x": "0px",
      "--look-y": "0px",
      "--lean": "0deg",
    });
  });

  it("derives pointer motion from the stage bounds, clamps it, and resets on leave", () => {
    render(<AnimatedAuthCharacters ariaLabel="pointer characters" />);
    const stage = screen.getByRole("img", { name: "pointer characters" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 300,
      bottom: 150,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(stage, { clientX: 200, clientY: 100 });
    expectMotion(stage, {
      "--look-x": "0px",
      "--look-y": "0px",
      "--lean": "0deg",
    });

    fireEvent.pointerMove(stage, { clientX: 400, clientY: -50 });
    expectMotion(stage, {
      "--look-x": "5px",
      "--look-y": "-4px",
      "--lean": "-5deg",
    });

    fireEvent.pointerMove(stage, { clientX: 0, clientY: 250 });
    expectMotion(stage, {
      "--look-x": "-5px",
      "--look-y": "4px",
      "--lean": "5deg",
    });

    fireEvent.pointerLeave(stage);
    expectMotion(stage, {
      "--look-x": "0px",
      "--look-y": "0px",
      "--lean": "0deg",
    });
  });

  it("applies the typing motion and class", () => {
    render(
      <AnimatedAuthCharacters ariaLabel="typing characters" isTyping />,
    );
    const stage = screen.getByRole("img", { name: "typing characters" });

    expect(stage.classList.contains("is-typing")).toBe(true);
    expect(stage.classList.contains("is-password-visible")).toBe(false);
    expectMotion(stage, {
      "--look-x": "2.75px",
      "--look-y": "1.8px",
      "--lean": "-2.75deg",
    });
  });

  it("lets an eligible password peek override typing motion", () => {
    render(
      <AnimatedAuthCharacters
        ariaLabel="password characters"
        isTyping
        passwordVisible
        hasPassword
      />,
    );
    const stage = screen.getByRole("img", { name: "password characters" });

    expect(stage.classList.contains("is-typing")).toBe(true);
    expect(stage.classList.contains("is-password-visible")).toBe(true);
    expectMotion(stage, {
      "--look-x": "-4px",
      "--look-y": "-2.4px",
      "--lean": "4deg",
    });
  });

  it("does not peek when password visibility has no password content", () => {
    render(
      <AnimatedAuthCharacters
        ariaLabel="empty password characters"
        passwordVisible
        hasPassword={false}
      />,
    );
    const stage = screen.getByRole("img", {
      name: "empty password characters",
    });

    expect(stage.classList.contains("is-password-visible")).toBe(false);
    expectMotion(stage, {
      "--look-x": "0px",
      "--look-y": "0px",
      "--lean": "0deg",
    });
  });

  it("exposes one labelled image while keeping every character decorative", () => {
    const { container } = render(
      <AnimatedAuthCharacters ariaLabel="접근 가능한 인증 캐릭터" />,
    );
    const stage = screen.getByRole("img", {
      name: "접근 가능한 인증 캐릭터",
    });
    const characters = container.querySelectorAll(".signup-character");

    expect(stage.getAttribute("aria-label")).toBe("접근 가능한 인증 캐릭터");
    expect(characters).toHaveLength(4);
    for (const character of characters) {
      expect(character.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("pins the approved full-source scanner finding", async () => {
    const sources = await collectUiSources(process.cwd());
    const inlineStyles = scanUiContract(sources).violations.filter(
      ({ path, ruleId }) =>
        path === "src/components/auth/AnimatedAuthCharacters.tsx" &&
        ruleId === "react.static-inline-style",
    );

    expect(
      inlineStyles.map(({ path, ruleId, fingerprint }) => ({
        path,
        ruleId,
        fingerprint,
      })),
    ).toEqual([
      {
        path: "src/components/auth/AnimatedAuthCharacters.tsx",
        ruleId: "react.static-inline-style",
        fingerprint:
          "336b99d84ad3aa6b3fdd2a81c50231f68017fdb6bfee99db47f238ff7ea3a67f",
      },
    ]);
  });
});
