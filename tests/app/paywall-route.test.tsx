// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const paywallShellMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: () => async (key: string) => key,
}));

vi.mock("@/components/app/WorkspaceBody", () => ({
  WorkspaceBody: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/settings/PaywallShell", () => ({
  PaywallShell: (props: unknown) => {
    paywallShellMock(props);
    return <div data-testid="paywall-shell" />;
  },
}));

import PaywallPage from "../../src/app/(workspace)/paywall/page";

describe("PaywallPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("passes the validated next-problem return target to the shell", async () => {
    const element = await PaywallPage({
      searchParams: Promise.resolve({ returnTo: "/practice/next#plans" }),
    });
    render(element);

    expect(screen.getByTestId("paywall-shell")).toBeTruthy();
    expect(paywallShellMock).toHaveBeenCalledWith({
      returnHref: "/practice/next#plans",
    });
  });

  it.each([
    {},
    { returnTo: "https://evil.example/practice/next" },
    { returnTo: ["/practice/next", "/dashboard"] },
  ])("uses the dashboard for a missing or unsafe return target", async (searchParams) => {
    const element = await PaywallPage({
      searchParams: Promise.resolve(searchParams),
    });
    render(element);

    expect(paywallShellMock).toHaveBeenCalledWith({ returnHref: "/dashboard" });
  });
});
