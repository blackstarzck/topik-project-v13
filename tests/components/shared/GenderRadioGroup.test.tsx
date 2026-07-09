// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { GenderRadioGroup } from "../../../src/components/shared/GenderRadioGroup";

afterEach(() => {
  cleanup();
});

describe("GenderRadioGroup", () => {
  it("renders only male and female options", () => {
    renderWithIntl(
      <GenderRadioGroup
        ariaLabel="성별"
        femaleLabel="여성"
        maleLabel="남성"
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "남성" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "여성" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "선택 안 함" })).toBeNull();
  });

  it("emits the selected gender and allows clearing the selected option", () => {
    const handleChange = vi.fn();
    const { rerender } = renderWithIntl(
      <GenderRadioGroup
        ariaLabel="성별"
        femaleLabel="여성"
        maleLabel="남성"
        value={null}
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "여성" }));
    expect(handleChange).toHaveBeenCalledWith("female");

    rerender(
      <GenderRadioGroup
        ariaLabel="성별"
        femaleLabel="여성"
        maleLabel="남성"
        value="female"
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "여성" }));
    expect(handleChange).toHaveBeenLastCalledWith(null);
  });
});
