// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppModal } from "../../../src/components/shared/AppModal";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

describe("AppModal placement", () => {
  it("keeps center placement as the default for existing consumers", () => {
    renderWithIntl(
      <AppModal open title="Default" onCancel={() => undefined}>
        body
      </AppModal>,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".ant-modal-centered")).toBeTruthy();
    expect(
      document
        .querySelector(".app-modal")
        ?.classList.contains("app-modal--center-origin"),
    ).toBe(true);
  });

  it("adds a stable bottom-right root hook without centering the dialog", () => {
    renderWithIntl(
      <AppModal
        open
        placement="bottom-right"
        title="Bottom right"
        onCancel={() => undefined}
      >
        body
      </AppModal>,
    );

    const root = document.querySelector(".app-modal");
    expect(root?.classList.contains("app-modal--bottom-right")).toBe(true);
    expect(document.querySelector(".ant-modal-centered")).toBeNull();
  });
});
