// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GoogleAnalyticsTags } from "../../../src/components/analytics/GoogleAnalyticsTags";

vi.mock("next/script", () => ({
  default: ({
    id,
    src,
    children,
  }: {
    id?: string;
    src?: string;
    children?: string;
  }) => (
    <script data-testid={id ?? "ga-src"} data-src={src}>
      {children}
    </script>
  ),
}));

describe("GoogleAnalyticsTags", () => {
  it("renders nothing without a valid GA4 measurement ID", () => {
    const { container } = render(
      <GoogleAnalyticsTags measurementId="UA-123" />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the gtag loader and config script for a valid measurement ID", () => {
    render(<GoogleAnalyticsTags measurementId="G-ABC123XYZ9" />);

    expect(screen.getByTestId("ga-src").getAttribute("data-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9",
    );
    expect(screen.getByTestId("google-analytics-init").textContent).toContain(
      "gtag('config', 'G-ABC123XYZ9')",
    );
  });
});
