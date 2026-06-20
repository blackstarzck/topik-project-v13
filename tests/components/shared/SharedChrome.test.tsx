// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { AppError } from "../../../src/components/shared/AppError";
import { AppNotFound } from "../../../src/components/shared/AppNotFound";
import { AppLoading } from "../../../src/components/shared/AppLoading";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

// These assertions match the verbatim ko strings staged under the `shared.*`
// namespace. They go green once the coordinator merges messages/_staging/shared.json
// into messages/ko.json (renderWithIntl loads the real ko catalog).

afterEach(() => {
  cleanup();
});

describe("AppError i18n chrome", () => {
  it("renders the shared.error title and the error message as subtitle", () => {
    renderWithIntl(<AppError error={new Error("boom-detail")} />);
    expect(screen.getByText("문제가 발생했어요")).toBeTruthy();
    // error.message takes precedence over the catalog subtitle fallback.
    expect(screen.getByText("boom-detail")).toBeTruthy();
  });

  it("falls back to the catalog subtitle and shows the retry CTA when reset is given", () => {
    renderWithIntl(<AppError reset={() => undefined} />);
    expect(screen.getByText("다시 시도해 주세요.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
  it("centers the error content in the visible viewport", () => {
    renderWithIntl(<AppError error={new Error("boom-detail")} />);

    expect(Array.from(screen.getByTestId("app-error").classList)).toEqual(
      expect.arrayContaining([
        "flex",
        "min-h-dvh",
        "items-center",
        "justify-center",
      ]),
    );
  });
});

describe("AppNotFound i18n chrome", () => {
  it("renders the shared.notFound title, subtitle, and dashboard CTA", () => {
    renderWithIntl(<AppNotFound />);
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeTruthy();
    expect(
      screen.getByText("요청하신 경로가 존재하지 않거나 이동되었습니다."),
    ).toBeTruthy();
    expect(screen.getByText("대시보드로 이동")).toBeTruthy();
  });
  it("centers the not-found content in the visible viewport", () => {
    renderWithIntl(<AppNotFound />);

    expect(
      Array.from(screen.getByTestId("app-not-found").classList),
    ).toEqual(
      expect.arrayContaining([
        "flex",
        "min-h-dvh",
        "items-center",
        "justify-center",
      ]),
    );
  });
});

describe("AppLoading i18n chrome", () => {
  it("renders the catalog default tip when no tip prop is passed", () => {
    renderWithIntl(<AppLoading />);
    expect(screen.getByText("불러오는 중...")).toBeTruthy();
  });

  it("honors an explicit tip prop over the catalog default", () => {
    renderWithIntl(<AppLoading tip="저장하는 중..." />);
    expect(screen.getByText("저장하는 중...")).toBeTruthy();
  });

  it("centers the spinner within the workspace page body area", () => {
    renderWithIntl(<AppLoading />);
    const shell = screen.getByText("불러오는 중...").closest(".flex");

    expect(Array.from(shell?.classList ?? [])).toEqual(
      expect.arrayContaining([
        "flex",
        "items-center",
        "justify-center",
        "min-h-[calc(100dvh-100px)]",
        "md:min-h-[calc(100dvh-48px)]",
      ]),
    );
  });
});
