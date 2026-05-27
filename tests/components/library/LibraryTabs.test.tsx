import { describe, expect, it } from "vitest";

import {
  buildLibraryTabUrl,
  isLibraryTab,
  parseLibraryTab,
} from "../../../src/components/library/library-tab-url";

/**
 * LibraryTabs URL state contract.
 *
 * vitest runs without a DOM in this project (no jsdom installed), so we
 * verify the URL-building helper that the React component calls inside its
 * antd Tabs `onChange`. The component itself is a thin wrapper:
 *   onChange={(key) => router.replace(buildLibraryTabUrl(key, params))}
 * so testing `buildLibraryTabUrl` exhaustively covers the URL contract.
 */
describe("LibraryTabs URL state", () => {
  it("isLibraryTab recognises all four library tabs", () => {
    expect(isLibraryTab("submissions")).toBe(true);
    expect(isLibraryTab("reports")).toBe(true);
    expect(isLibraryTab("problems")).toBe(true);
    expect(isLibraryTab("exports")).toBe(true);
  });

  it("isLibraryTab rejects unknown tab keys", () => {
    expect(isLibraryTab("attempts")).toBe(false);
    expect(isLibraryTab("")).toBe(false);
    expect(isLibraryTab(null)).toBe(false);
    expect(isLibraryTab(undefined)).toBe(false);
    expect(isLibraryTab(42)).toBe(false);
  });

  it("parseLibraryTab returns the default tab ('submissions') when missing/invalid", () => {
    expect(parseLibraryTab(null)).toBe("submissions");
    expect(parseLibraryTab(undefined)).toBe("submissions");
    expect(parseLibraryTab("")).toBe("submissions");
    expect(parseLibraryTab("nonsense")).toBe("submissions");
  });

  it("parseLibraryTab passes through valid tab keys", () => {
    expect(parseLibraryTab("reports")).toBe("reports");
    expect(parseLibraryTab("problems")).toBe("problems");
    expect(parseLibraryTab("exports")).toBe("exports");
    expect(parseLibraryTab("submissions")).toBe("submissions");
  });

  it("buildLibraryTabUrl omits ?tab= for the default tab (clean canonical URL)", () => {
    const url = buildLibraryTabUrl("submissions", new URLSearchParams());
    expect(url).toBe("/library");
  });

  it("buildLibraryTabUrl sets ?tab= for non-default tabs", () => {
    expect(buildLibraryTabUrl("reports", new URLSearchParams())).toBe(
      "/library?tab=reports",
    );
    expect(buildLibraryTabUrl("problems", new URLSearchParams())).toBe(
      "/library?tab=problems",
    );
    expect(buildLibraryTabUrl("exports", new URLSearchParams())).toBe(
      "/library?tab=exports",
    );
  });

  it("buildLibraryTabUrl preserves unrelated search params", () => {
    const params = new URLSearchParams("filter=mine&page=2");
    const url = buildLibraryTabUrl("reports", params);
    // URLSearchParams preserves insertion order — assert via parsed form so
    // we don't lock the test to a fragile literal.
    const sp = new URLSearchParams(url.split("?")[1]);
    expect(sp.get("tab")).toBe("reports");
    expect(sp.get("filter")).toBe("mine");
    expect(sp.get("page")).toBe("2");
  });

  it("buildLibraryTabUrl removes a stale ?tab= entry when switching to default", () => {
    const params = new URLSearchParams("tab=reports&q=hi");
    const url = buildLibraryTabUrl("submissions", params);
    const sp = new URLSearchParams(url.split("?")[1] ?? "");
    expect(sp.has("tab")).toBe(false);
    expect(sp.get("q")).toBe("hi");
  });

  it("buildLibraryTabUrl does not mutate the input URLSearchParams", () => {
    const params = new URLSearchParams("tab=submissions&q=keep");
    const before = params.toString();
    buildLibraryTabUrl("exports", params);
    expect(params.toString()).toBe(before);
  });
});
