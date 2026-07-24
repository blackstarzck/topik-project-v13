// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
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

  it("renders a non-blocking bottom-right panel without a mask", async () => {
    renderWithIntl(
      <AppModal
        open
        placement="bottom-right"
        nonBlocking
        title="Non-blocking panel"
        closable={false}
      >
        body
      </AppModal>,
    );

    const root = document.querySelector(".app-modal");
    expect(root?.classList.contains("app-modal--non-blocking")).toBe(true);
    expect(document.querySelector(".ant-modal-mask")).toBeNull();
    expect(document.querySelector(".ant-modal-close")).toBeNull();
    await waitFor(() =>
      expect(
        screen
          .getByRole("dialog", { name: "Non-blocking panel" })
          .getAttribute("aria-modal"),
      ).toBe("false"),
    );
  });
});
