// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StatusHelpCard } from "../../../src/components/profile/StatusHelpCard";

afterEach(() => cleanup());

describe("StatusHelpCard (Phase 7-E Task 10)", () => {
  it("renders role label, plan, and join date", () => {
    render(
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

  it("renders Korean role label for admin trio", () => {
    render(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="content_admin"
        planLabel="enterprise"
      />,
    );
    expect(screen.getByText("콘텐츠 관리자")).toBeTruthy();
  });

  it("links to settings/notifications and settings/language", () => {
    render(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="learner"
        planLabel="free"
      />,
    );
    const notif = screen.getByText("알림 설정");
    const lang = screen.getByText("언어 설정");
    expect(notif.closest("a")?.getAttribute("href")).toBe("/settings/notifications");
    expect(lang.closest("a")?.getAttribute("href")).toBe("/settings/language");
  });

  it("falls back to raw role string for unknown role", () => {
    render(
      <StatusHelpCard
        joinedAt="2026-05-22T00:00:00Z"
        appRole="some_future_role"
        planLabel="free"
      />,
    );
    expect(screen.getByText("some_future_role")).toBeTruthy();
  });
});
