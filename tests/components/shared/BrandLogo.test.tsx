// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { BrandLogo } from "../../../src/components/shared/BrandLogo";

afterEach(() => {
  cleanup();
});

describe("BrandLogo", () => {
  it("uses dimensions that match the uploaded logo asset ratio", () => {
    const { container } = render(<BrandLogo height={173} />);
    const image = container.querySelector("img");

    expect(image?.getAttribute("height")).toBe("173");
    expect(image?.getAttribute("width")).toBe("491");
  });
});
