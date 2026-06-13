import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("/auth/consent page", () => {
  it("keeps Ant Design UI out of the server route page", () => {
    const source = readFileSync("src/app/auth/consent/page.tsx", "utf8");

    expect(source).not.toMatch(/from\s+["']antd["']/);
    expect(source).toContain("AuthConsentPanel");
  });
});
