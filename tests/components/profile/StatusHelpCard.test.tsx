// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { StatusHelpCard } from "../../../src/components/profile/StatusHelpCard";
import koMessages from "../../../messages/ko.json";

afterEach(() => cleanup());

// StatusHelpCard calls useTranslations (next-intl), so it must render inside a
// NextIntlClientProvider against the real ko catalog.
function renderCard(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("StatusHelpCard (Phase 7-E Task 10)", () => {
  it("renders role label, plan, and join date", () => {
    renderCard(
      <StatusHelpCard
        joinedAt="2026-05-22T07:27:40.629953Z"
        appRole="learner"
        planLabel="free"
      />,
    );
    expect(screen.getByText("학습자")).toBeTruthy();
    expect(screen.getByText("free")).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it("renders institution affiliation only when an affiliation code exists", () => {
    const { rerender } = renderCard(
      <StatusHelpCard
        joinedAt="2026-05-22T07:27:40.629953Z"
        appRole="learner"
        planLabel="free"
      />,
    );

    expect(screen.queryByText("기관 소속")).toBeNull();
    expect(screen.queryByText("기관 코드 EXPO2026-BOOTH-A")).toBeNull();

    rerender(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <StatusHelpCard
          joinedAt="2026-05-22T07:27:40.629953Z"
          appRole="learner"
          planLabel="free"
          affiliationCode="EXPO2026-BOOTH-A"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("기관 소속")).toBeTruthy();
    expect(screen.getByText("기관 코드 EXPO2026-BOOTH-A")).toBeTruthy();
  });

  it("renders Korean role label for admin trio", () => {
    renderCard(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="content_admin"
        planLabel="enterprise"
      />,
    );
    expect(screen.getByText("콘텐츠 관리자")).toBeTruthy();
  });

  it("does not render the notification/language quick links (removed in redesign)", () => {
    renderCard(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="learner"
        planLabel="free"
      />,
    );
    expect(screen.queryByText("알림 설정")).toBeNull();
    expect(screen.queryByText("언어 설정")).toBeNull();
  });

  it("falls back to raw role string for unknown role", () => {
    renderCard(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="some_future_role"
        planLabel="free"
      />,
    );
    expect(screen.getByText("some_future_role")).toBeTruthy();
  });
});
