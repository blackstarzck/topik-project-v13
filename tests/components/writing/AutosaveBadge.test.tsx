// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import {
  IntlAntdWrapper,
  renderWithIntl,
} from "../../test-utils/renderWithIntl";
import { AutosaveBadge } from "../../../src/components/writing/AutosaveBadge";

afterEach(() => cleanup());

describe("AutosaveBadge", () => {
  it("does not server-render locale-dependent saved time", () => {
    const html = renderToString(
      <IntlAntdWrapper>
        <AutosaveBadge
          status="clean"
          lastSavedAt="2026-06-08T07:11:00.000Z"
        />
      </IntlAntdWrapper>,
    );

    expect(html).toContain("저장됨");
    expect(html).not.toContain("PM");
    expect(html).not.toContain("오후");
  });

  it("adds the saved time after the client mounts", async () => {
    renderWithIntl(
      <AutosaveBadge
        status="clean"
        lastSavedAt="2026-06-08T07:11:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/저장됨 · \d{2}:\d{2}/)).toBeTruthy();
    });
  });
});
