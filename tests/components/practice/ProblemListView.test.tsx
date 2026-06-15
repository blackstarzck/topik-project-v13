// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../messages/en.json";

const navState = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navState.replace,
  }),
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

import { ProblemListView } from "../../../src/components/practice/ProblemListView";

function renderInApp(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navState.replace.mockReset();
  navState.search = "";
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe("ProblemListView", () => {
  it("uses the recommendation tab card style without a recommendation badge", () => {
    renderInApp(<ProblemListView userId="user-1" />);

    const allTabRoot = screen
      .getByText(enMessages.practice.common.typeTabAll)
      .closest(".ant-segmented");
    expect(allTabRoot?.className).toContain("problem-type-tabs");
    expect(allTabRoot?.className).toContain("problem-type-tabs--with-all");
    expect(
      screen.getByText(enMessages.practice.common.typeTabAll).closest("label")
        ?.className,
    ).toContain("is-selected");
    expect(
      screen.queryByText(
        enMessages.practice.recommendations.typeRecommendedBadge,
      ),
    ).toBeNull();

    fireEvent.click(
      screen.getByText(enMessages.practice.recommendations.typeButtonLabel52),
    );

    expect(navState.replace).toHaveBeenCalledWith(
      "/practice/problems?type=52&page=1",
    );
  });

  it("updates the recommended-only control immediately while URL navigation is still pending", async () => {
    renderInApp(<ProblemListView userId="user-1" />);

    expect(screen.queryByText("Recommendation")).toBeNull();
    expect(screen.getAllByText("Recommended only")).toHaveLength(1);

    const recommendedSwitch = screen.getByRole("switch", {
      name: "Show recommended problems only",
    });
    expect(recommendedSwitch.getAttribute("aria-checked")).toBe("false");
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled();
    });
    const initialRpcCallCount = rpcMock.mock.calls.length;

    fireEvent.click(recommendedSwitch);

    await waitFor(() => {
      expect(recommendedSwitch.getAttribute("aria-checked")).toBe("true");
      expect(screen.getAllByText("Recommended only")).toHaveLength(2);
    });
    expect(navState.replace).toHaveBeenCalledWith(
      "/practice/problems?recommended=1&page=1",
    );

    await waitFor(() => {
      expect(rpcMock.mock.calls.length).toBeGreaterThan(initialRpcCallCount);
    });
  });
});
