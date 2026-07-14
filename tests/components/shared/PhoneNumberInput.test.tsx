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
        countryCode="KR"
        locale="ko"
        value="01012345678"
        onChange={vi.fn()}
        onCountryCodeChange={vi.fn()}
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

  it("normalizes pasted text to local digits without the selected country calling code", () => {
    const handleChange = vi.fn();
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가번호"
        countryCode="KR"
        locale="ko"
        value=""
        onChange={handleChange}
        onCountryCodeChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("전화번호"), {
      target: { value: "+82 010-1234-5678 abc 901234567890" },
    });

    expect(handleChange).toHaveBeenCalledWith("01012345678901234567");
  });

  it("does not strip calling-code-like prefixes from an already stored local number", () => {
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가 번호"
        countryCode="KR"
        locale="ko"
        value="8212345678"
        onChange={vi.fn()}
        onCountryCodeChange={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("전화번호") as HTMLInputElement).value).toBe(
      "8212345678",
    );
  });

  it("updates the selected country code without rewriting the stored local digits", () => {
    const handleChange = vi.fn();
    const handleCountryCodeChange = vi.fn();
    renderWithIntl(
      <PhoneNumberInput
        ariaLabel="전화번호"
        callingCodeAriaLabel="국가번호"
        countryCode="KR"
        locale="ko"
        value="1012345678"
        onChange={handleChange}
        onCountryCodeChange={handleCountryCodeChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "국가번호" }));
    fireEvent.click(screen.getByText("+84"));

    expect(handleCountryCodeChange).toHaveBeenCalledWith("VN");
    expect(handleChange).not.toHaveBeenCalled();
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
        countryCode="KR"
        locale="ko"
        value=""
        onChange={vi.fn()}
        onCountryCodeChange={vi.fn()}
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
