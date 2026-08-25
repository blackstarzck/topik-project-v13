// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";

import {
  IntlAntdWrapper,
  renderWithIntl,
} from "../../test-utils/renderWithIntl";
import { AutosaveBadge } from "../../../src/components/writing/AutosaveBadge";
import { hasExactCssRule } from "./writing-style-contract";

afterEach(() => cleanup());

describe("AutosaveBadge", () => {
  it.each([
    ["clean", "success"],
    ["dirty", "warning"],
    ["syncing", "processing"],
    ["failed", "error"],
    ["superseded", "default"],
  ] as const)(
    "preserves the %s status as the public %s Tag tone",
    (status, tone) => {
      const { container } = renderWithIntl(
        <AutosaveBadge status={status} lastSavedAt={null} />,
      );

      expect(container.querySelector(".ant-tag")?.classList).toContain(
        `ant-tag-${tone}`,
      );
    },
  );

  it("keeps non-tone badge geometry local without masking AntD status paint", () => {
    const modulePath = "src/components/writing/WritingExamShell.module.css";
    const moduleCss = readFileSync(modulePath, "utf8");
    const globalCss = readFileSync("src/styles/global.css", "utf8");

    expect(existsSync(modulePath)).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".saveState :global(.ant-tag)",
        "margin-inline-end: 0; border: 0; font-size: 12px; font-weight: 700;",
      ),
    ).toBe(true);
    expect(moduleCss).not.toMatch(
      /\.saveState\s+:global\(\.ant-tag\)[^{]*\{[^}]*(?:background|color)\s*:/su,
    );
    expect(globalCss).not.toMatch(
      /\.writing-exam-header__save-state\s+\.ant-tag\s*\{/u,
    );
  });

  it("does not server-render locale-dependent saved time", () => {
    const html = renderToString(
      <IntlAntdWrapper>
        <AutosaveBadge status="clean" lastSavedAt="2026-06-08T07:11:00.000Z" />
      </IntlAntdWrapper>,
    );

    expect(html).toContain("저장됨");
    expect(html).not.toContain("PM");
    expect(html).not.toContain("오후");
  });

  it("adds the saved time after the client mounts", async () => {
    renderWithIntl(
      <AutosaveBadge status="clean" lastSavedAt="2026-06-08T07:11:00.000Z" />,
    );

    await waitFor(() => {
      expect(screen.getByText(/저장됨 · \d{2}:\d{2}/)).toBeTruthy();
    });
  });
});
