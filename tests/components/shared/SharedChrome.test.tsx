// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { AppError } from "../../../src/components/shared/AppError";
import { AppNotFound } from "../../../src/components/shared/AppNotFound";
import { AppLoading } from "../../../src/components/shared/AppLoading";
import { UnavailableState } from "../../../src/components/shared/UnavailableState";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

// These assertions match the verbatim ko strings staged under the `shared.*`
// namespace. They go green once the coordinator merges messages/_staging/shared.json
// into messages/ko.json (renderWithIntl loads the real ko catalog).

afterEach(() => {
  cleanup();
});

describe("AppError i18n chrome", () => {
  it("renders a broad message without exposing the internal error", () => {
    renderWithIntl(
      <AppError
        error={
          new Error("permission denied SQL token=secret student@example.com")
        }
      />,
    );
    expect(screen.getByText("문제가 발생했어요")).toBeTruthy();
    expect(
      screen.getByText(
        "서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/permission denied|secret|example\.com/i),
    ).toBeNull();
  });

  it("shows the broad message and retry CTA when reset is given", () => {
    renderWithIntl(<AppError reset={() => undefined} />);
    expect(
      screen.getByText(
        "서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
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

describe("UnavailableState", () => {
  it.each([
    [
      "general",
      "서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
    ],
    [
      "required-information",
      "필수 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ],
    ["resource", "자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ] as const)("renders the %s broad message", (variant, message) => {
    renderWithIntl(<UnavailableState variant={variant} />);

    expect(screen.getByText(message)).toBeTruthy();
  });

  it("renders only caller-supplied recovery actions", () => {
    renderWithIntl(
      <UnavailableState
        variant="resource"
        actions={[
          { key: "retry", label: "다시 시도", onClick: () => undefined },
          { key: "back", label: "뒤로", href: "/dashboard" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "뒤로" }).getAttribute("href"),
    ).toBe("/dashboard");
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

    expect(Array.from(screen.getByTestId("app-not-found").classList)).toEqual(
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
