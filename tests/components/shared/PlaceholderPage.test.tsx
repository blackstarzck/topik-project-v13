// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import { PlaceholderPage } from "../../../src/components/shared/PlaceholderPage";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => {
  cleanup();
});

describe("PlaceholderPage", () => {
  it("renders on the shared card surface", () => {
    const { container } = renderWithIntl(
      <PlaceholderPage iaCode="P-01" title="title" phaseHint="phase" />,
    );
    const card = container.querySelector(".ant-card");

    expect(card).toBeTruthy();
    expect(card?.classList.contains("app-card")).toBe(true);
    expect(card?.classList.contains("app-surface")).toBe(true);
  });
});
