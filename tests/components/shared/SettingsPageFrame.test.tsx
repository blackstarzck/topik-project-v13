// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const FRAME_SOURCE_PATH = join(
  process.cwd(),
  "src/components/shared/SettingsPageFrame.tsx",
);
const FRAME_STYLES_PATH = join(
  process.cwd(),
  "src/components/shared/SettingsPageFrame.module.css",
);
const FRAME_MODULE_PATH = "../../../src/components/shared/SettingsPageFrame";
const FRAME_CONSUMERS = [
  "src/app/(workspace)/profile/page.tsx",
  "src/app/(workspace)/settings/account/page.tsx",
  "src/app/(workspace)/settings/language/page.tsx",
  "src/app/(workspace)/settings/learning/page.tsx",
  "src/app/(workspace)/settings/notifications/page.tsx",
  "src/components/shared/SettingsPageSkeleton.tsx",
] as const;

afterEach(() => {
  cleanup();
});

async function loadSettingsPageFrame() {
  try {
    return await import(FRAME_MODULE_PATH);
  } catch (error) {
    if (!existsSync(FRAME_SOURCE_PATH)) return null;
    throw error;
  }
}

describe("SettingsPageFrame", () => {
  it("owns the workspace body and the unchanged 640px content frame", async () => {
    const frameModule = await loadSettingsPageFrame();
    expect(frameModule).not.toBeNull();
    if (!frameModule) return;

    render(
      <frameModule.SettingsPageFrame>
        <span>settings content</span>
      </frameModule.SettingsPageFrame>,
    );

    const workspaceBody = screen.getByTestId("workspace-page-body");
    const contentFrame = screen.getByText("settings content").parentElement;

    expect(workspaceBody.getAttribute("data-workspace-body-size")).toBe(
      "workspace",
    );
    expect(contentFrame?.parentElement).toBe(workspaceBody);
    expect(contentFrame?.tagName).toBe("DIV");
    expect(contentFrame?.className).not.toBe("");
    expect(contentFrame?.classList.contains("w-full")).toBe(false);
    expect(contentFrame?.classList.contains("max-w-160")).toBe(false);
    expect(readFileSync(FRAME_STYLES_PATH, "utf8")).toMatch(
      /\.frame\s*\{\s*width:\s*100%;\s*max-width:\s*640px;\s*\}/u,
    );
  });

  it("stays server-compatible and is the only owner used by all six consumers", () => {
    const frameSource = existsSync(FRAME_SOURCE_PATH)
      ? readFileSync(FRAME_SOURCE_PATH, "utf8")
      : "";

    expect(frameSource).not.toMatch(/^\s*["']use client["'];/u);
    expect(frameSource).toContain("<WorkspaceBody>");
    expect(frameSource).toContain("className={styles.frame}");

    for (const relativePath of FRAME_CONSUMERS) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(source).toContain("SettingsPageFrame");
      expect(source).not.toContain("w-full max-w-[640px]");
      expect(source).not.toContain("<WorkspaceBody>");
    }
  });
});
