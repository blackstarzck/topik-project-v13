// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import {
  PHONE_NUMBER_INPUT_MAX_LENGTH,
  PhoneNumberInput,
} from "../../../src/components/shared/PhoneNumberInput";

afterEach(() => {
  cleanup();
});

describe("PhoneNumberInput", () => {
  it("renders a tel input with the default country calling code", () => {
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가번호"
        locale="ko"
        value="01012345678"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("전화번호") as HTMLInputElement;
    expect(input.type).toBe("tel");
    expect(input.inputMode).toBe("numeric");
    expect(input.maxLength).toBe(PHONE_NUMBER_INPUT_MAX_LENGTH);
    expect(input.value).toBe("01012345678");
    expect(
      screen.getByTestId("phone-country-code-select").textContent,
    ).toContain("+82");
  });

  it("normalizes pasted text to digits without composing the country code", () => {
    const handleChange = vi.fn();
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가번호"
        locale="ko"
        value=""
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("전화번호"), {
      target: { value: "+82 010-1234-5678 abc 901234567890" },
    });

    expect(handleChange).toHaveBeenCalledWith("82010123456789012345");
  });

  it("reports the selected country code separately from the local digits", async () => {
    const handleCountryCodeChange = vi.fn();
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="?꾪솕踰덊샇"
        callingCodeAriaLabel="援??踰덊샇"
        countryCode="KR"
        locale="ko"
        value=""
        onChange={vi.fn()}
        onCountryCodeChange={handleCountryCodeChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "援??踰덊샇" }));
    const matches = await screen.findAllByText("+84");
    const option = matches.find((node) =>
      node.closest(".ant-select-item-option"),
    );
    if (!option) {
      throw new Error("Vietnam phone country option not found");
    }
    fireEvent.click(option);

    expect(handleCountryCodeChange).toHaveBeenCalledWith("VN");
  });

  it("blocks non-digit keyCode input while allowing digit keys", () => {
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가번호"
        locale="ko"
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("전화번호");

    expect(
      fireEvent.keyDown(input, {
        key: "a",
        code: "KeyA",
        keyCode: 65,
        which: 65,
      }),
    ).toBe(false);
    expect(
      fireEvent.keyDown(input, {
        key: "1",
        code: "Digit1",
        keyCode: 49,
        which: 49,
      }),
    ).toBe(true);
  });
});
