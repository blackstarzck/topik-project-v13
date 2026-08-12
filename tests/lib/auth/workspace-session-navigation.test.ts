import { describe, expect, it, vi } from "vitest";

import { replaceWorkspaceDocument } from "../../../src/lib/auth/workspace-session-navigation";

describe("replaceWorkspaceDocument", () => {
  it("replaces the full document at the current URL", () => {
    const replace = vi.fn();

    replaceWorkspaceDocument({
      href: "https://talkpik.test/dashboard",
      replace,
    });

    expect(replace).toHaveBeenCalledWith("https://talkpik.test/dashboard");
  });
});
