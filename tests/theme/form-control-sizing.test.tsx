// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Input, Select } from "antd";

import koMessages from "../../messages/ko.json";
import { AppProviders } from "../../src/app/providers";

describe("AppProviders form control theming", () => {
  afterEach(() => {
    cleanup();
  });

  test("does not inject per-component sizing class hooks", () => {
    const { container } = render(
      <AppProviders messages={koMessages}>
        <Input aria-label="plain input" />
        <Input.Password aria-label="password input" />
        <Input.TextArea aria-label="profile textarea" />
        <Select
          aria-label="level select"
          options={[{ label: "TOPIK II", value: "topik-2" }]}
        />
      </AppProviders>,
    );

    expect(screen.getByLabelText("plain input").className).not.toContain(
      "app-form-input-control",
    );
    expect(
      container
        .querySelector(".ant-input-password")
        ?.classList.contains("app-form-input-control"),
    ).toBe(false);
    expect(
      container
        .querySelector(".ant-select")
        ?.classList.contains("app-form-select-control"),
    ).toBe(false);
    expect(
      screen
        .getByLabelText("profile textarea")
        .classList.contains("app-form-input-control"),
    ).toBe(false);
  });
});
