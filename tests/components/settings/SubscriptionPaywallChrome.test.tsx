// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import koMessages from "../../../messages/ko.json";

// router is exercised on back/refresh/replace paths; stub it so next/navigation
// resolves under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// billing-data hits Supabase; mock the data accessors. cadenceLabelKey /
// formatPlanPrice / formatAmountCents / planFeatureList are pure, so keep the
// real implementations via importActual.
const fetchMySubscriptionMock = vi.fn();
const fetchActivePlansMock = vi.fn();
const fetchPaymentHistoryMock = vi.fn();

vi.mock("../../../src/components/settings/billing-data", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/components/settings/billing-data")
  >("../../../src/components/settings/billing-data");
  return {
    ...actual,
    fetchMySubscription: (...a: unknown[]) => fetchMySubscriptionMock(...a),
    fetchActivePlans: (...a: unknown[]) => fetchActivePlansMock(...a),
    fetchPaymentHistory: (...a: unknown[]) => fetchPaymentHistoryMock(...a),
  };
});

import { SubscriptionShell } from "../../../src/components/settings/SubscriptionShell";
import { PaywallShell } from "../../../src/components/settings/PaywallShell";

// The settings/subscription/paywall catalog is merged into messages/ko.json by
// the coordinator. Render against the real ko catalog (same Korean strings the
// assertions match) so these stay green without depending on _staging/.
function renderShell(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  fetchMySubscriptionMock.mockReset();
  fetchActivePlansMock.mockReset();
  fetchPaymentHistoryMock.mockReset();

  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SubscriptionShell (i18n chrome)", () => {
  it("renders the heading and the no-subscription empty state", async () => {
    fetchMySubscriptionMock.mockResolvedValue(null);
    fetchPaymentHistoryMock.mockResolvedValue({ rows: [], total: 0 });

    renderShell(<SubscriptionShell />);

    expect(screen.getByText("구독 관리")).toBeTruthy();
    expect(screen.queryByText("X-04")).toBeNull();
    expect(
      screen.getByText("현재 구독 상태와 결제 이력을 확인하고 관리하세요."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("구독 없음")).toBeTruthy();
    });
    expect(screen.getByTestId("subscription-shell")).toBeTruthy();
    expect(screen.getByTestId("subscription-current-card")).toBeTruthy();
    expect(screen.getByTestId("subscription-no-sub")).toBeTruthy();
    expect(screen.getByTestId("subscription-start-cta")).toBeTruthy();
    expect(screen.getByTestId("subscription-history-card")).toBeTruthy();
    expect(screen.getByTestId("subscription-help-card")).toBeTruthy();
    expect(
      screen.getByText("현재 이용 중인 유료 구독이 없습니다."),
    ).toBeTruthy();
    // help panel + payment-history empty locale.
    expect(screen.getByText("도움말")).toBeTruthy();
    expect(screen.getByText("결제 이력이 없습니다.")).toBeTruthy();
  });

  it("resolves the active status badge and cadence label for a live subscription", async () => {
    fetchMySubscriptionMock.mockResolvedValue({
      id: "sub-1",
      user_id: "u-1",
      plan_key: "pro_monthly",
      billing_cadence: "monthly",
      status: "active",
      current_period_start: null,
      current_period_end: "2026-07-01T00:00:00Z",
      cancel_at: null,
      provider: null,
      provider_subscription_id: null,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    });
    fetchActivePlansMock.mockResolvedValue([
      {
        plan_key: "pro_monthly",
        name: "프로 월간",
        cadence: "monthly",
        price_cents: 990000,
        currency: "KRW",
        features: [],
        recommended: true,
        active: true,
      },
    ]);
    fetchPaymentHistoryMock.mockResolvedValue({ rows: [], total: 0 });

    renderShell(<SubscriptionShell />);

    await waitFor(() => {
      // status enum "active" -> subscription.status.active.
      expect(screen.getByText("이용 중")).toBeTruthy();
    });
    // cadence "monthly" -> subscription.cadence.monthly.
    expect(screen.getByText("월간")).toBeTruthy();
    // change-action card present for a live subscription.
    expect(screen.getByTestId("subscription-change-card")).toBeTruthy();
    expect(screen.getByTestId("subscription-change-plan")).toBeTruthy();
    expect(screen.getByTestId("subscription-change-payment")).toBeTruthy();
    expect(screen.getByTestId("subscription-cancel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "구독 취소" })).toBeTruthy();
    expect(screen.getByText("다음 청구 금액")).toBeTruthy();
    expect(screen.getByText("₩9,900")).toBeTruthy();
    expect(screen.getByTestId("subscription-payment-card")).toBeTruthy();
    expect(
      screen.getByText("결제수단 정보는 결제 연동 후 표시됩니다."),
    ).toBeTruthy();
    expect(screen.getByTestId("subscription-usage-card")).toBeTruthy();
    expect(screen.getByText("AI 사용량은 준비 중입니다.")).toBeTruthy();
  });

  it("uses cancel_at as the scheduled cancellation date", async () => {
    fetchMySubscriptionMock.mockResolvedValue({
      id: "sub-1",
      user_id: "u-1",
      plan_key: "pro_monthly",
      billing_cadence: "monthly",
      status: "active",
      current_period_start: null,
      current_period_end: "2026-07-01T00:00:00Z",
      cancel_at: "2026-06-20T00:00:00Z",
      provider: null,
      provider_subscription_id: null,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    });
    fetchActivePlansMock.mockResolvedValue([
      {
        plan_key: "pro_monthly",
        name: "프로 월간",
        cadence: "monthly",
        price_cents: 990000,
        currency: "KRW",
        features: [],
        recommended: true,
        active: true,
      },
    ]);
    fetchPaymentHistoryMock.mockResolvedValue({ rows: [], total: 0 });

    renderShell(<SubscriptionShell />);

    await waitFor(() => {
      expect(screen.getByText(/2026\. 6\. 20\..*해지 예정/)).toBeTruthy();
    });
    expect(
      screen.queryByText(/2026\. 7\. 1\..*해지 예정/),
    ).toBeNull();
  });
});

describe("PaywallShell (i18n chrome)", () => {
  it("renders the paywall regions without exposing the IA code", async () => {
    fetchMySubscriptionMock.mockResolvedValue(null);
    fetchActivePlansMock.mockResolvedValue([
      {
        plan_key: "pro_monthly",
        name: "프로 월간",
        cadence: "monthly",
        price_cents: 990000,
        currency: "KRW",
        features: ["AI 첨삭"],
        recommended: false,
        active: true,
      },
      {
        plan_key: "pro_quarterly",
        name: "프로 분기",
        cadence: "quarterly",
        price_cents: 2670000,
        currency: "KRW",
        features: ["월간 혜택 전부", "분기 17% 할인", "우선 첨삭 큐"],
        recommended: true,
        active: true,
      },
      {
        plan_key: "pro_yearly",
        name: "프로 연간",
        cadence: "yearly",
        price_cents: 9900000,
        currency: "KRW",
        features: ["월간 혜택 전부", "연간 17% 할인", "PDF 내보내기"],
        recommended: false,
        active: true,
      },
    ]);

    renderShell(<PaywallShell />);

    expect(screen.getByText("구독 시작하기")).toBeTruthy();
    expect(screen.queryByText("X-03")).toBeNull();

    await waitFor(() => {
      // recommended badge + ICU "{cadence} 구독 선택" with cadence "분기".
      expect(screen.getByText("추천")).toBeTruthy();
    });
    expect(
      screen.getByRole("button", { name: "분기 구독 선택" }),
    ).toBeTruthy();
    expect(screen.getByText("분기 10% 할인")).toBeTruthy();
    expect(screen.queryByText("분기 17% 할인")).toBeNull();
    expect(screen.getByText("연간 17% 할인")).toBeTruthy();
    // benefits panel verbatim leaf.
    expect(screen.getByText("· AI 작문 첨삭 무제한")).toBeTruthy();
    expect(screen.getByText("결제 안내")).toBeTruthy();
  });

  it("shows the no-plans alert when the catalog is empty", async () => {
    fetchMySubscriptionMock.mockResolvedValue(null);
    fetchActivePlansMock.mockResolvedValue([]);

    renderShell(<PaywallShell />);

    await waitFor(() => {
      expect(
        screen.getByText("현재 안내 가능한 플랜이 없습니다."),
      ).toBeTruthy();
    });
  });
});
