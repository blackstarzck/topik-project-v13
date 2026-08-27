// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GoogleMark } from "../../../src/components/auth/GoogleMark";

const assetPath = join(process.cwd(), "public/assets/brands/google-g.png");
const componentPath = join(process.cwd(), "src/components/auth/GoogleMark.tsx");
const officialAssetHash =
  "D1CE9C2AF0B10A7333ABC99BC706F9A6A199E5B65BF3E3009624F076B8638E6A";

afterEach(() => {
  cleanup();
});

describe("GoogleMark", () => {
  it("renders the official local brand asset at the default size", () => {
    const { container } = render(<GoogleMark />);
    const image = container.querySelector("img");

    expect(image).not.toBeNull();
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "/assets/brands/google-g.png",
    );
    expect(image?.getAttribute("width")).toBe("18");
    expect(image?.getAttribute("height")).toBe("18");
    expect(image?.getAttribute("aria-hidden")).toBe("true");
    expect(image?.getAttribute("alt")).toBe("");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("preserves the account-card size", () => {
    const { container } = render(<GoogleMark size={20} />);
    const image = container.querySelector("img");

    expect(image?.getAttribute("width")).toBe("20");
    expect(image?.getAttribute("height")).toBe("20");
  });

  it("displays the 200 by 204 asset without stretching it to the square box", () => {
    const asset = readFileSync(assetPath);
    const intrinsicWidth = asset.readUInt32BE(16);
    const intrinsicHeight = asset.readUInt32BE(20);
    const { container } = render(<GoogleMark />);
    const image = container.querySelector("img");

    expect([intrinsicWidth, intrinsicHeight]).toEqual([200, 204]);
    expect(image?.className.split(" ")).toContain("h-auto");
    expect(image?.getAttribute("width")).toBe("18");
    expect(image?.getAttribute("height")).toBe("18");
  });

  it("keeps the exact official Google asset bytes", () => {
    expect(existsSync(assetPath)).toBe(true);
    if (!existsSync(assetPath)) return;

    const hash = createHash("sha256")
      .update(readFileSync(assetPath))
      .digest("hex")
      .toUpperCase();

    expect(hash).toBe(officialAssetHash);
  });

  it("does not retain the previous inline four-color SVG", () => {
    const source = readFileSync(componentPath, "utf8");

    expect(source).not.toMatch(/<svg|<path/u);
    expect(source).not.toMatch(/#(?:4285F4|34A853|FBBC05|EA4335)/iu);
  });
});
