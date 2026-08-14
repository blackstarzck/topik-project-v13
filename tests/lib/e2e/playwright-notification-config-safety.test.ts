import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const configs = [
  "playwright.notif.config.ts",
  "playwright.notif-error.config.ts",
] as const;
const specs = [
  "tests/e2e/notification-failure-states.spec.ts",
  "tests/e2e/notification-error-states.spec.ts",
] as const;

describe("notification Playwright config runtime safety", () => {
  it.each(configs)("validates %s through the shared loopback guard", (file) => {
    const source = readFileSync(
      new URL(`../../../${file}`, import.meta.url),
      "utf8",
    );

    expect(source).toContain("assertLoopbackRuntimeTarget");
    expect(source).toContain("assertLocalPublicMutationTarget(process.env)");
    expect(source).not.toContain("assertLocalPrivilegedMutationTarget");
    expect(source).toMatch(
      /const BASE_URL\s*=\s*assertLoopbackRuntimeTarget\([\s\S]*?process\.env\.E2E_BASE_URL/u,
    );
    expect(source).not.toMatch(
      /const BASE_URL\s*=\s*process\.env\.E2E_BASE_URL/u,
    );
    expect(source).toContain("baseURL: BASE_URL");
  });

  it.each(specs)(
    "requires E2E_NTF_PASSWORD without a committed fallback in %s",
    (file) => {
      const source = readFileSync(
        new URL(`../../../${file}`, import.meta.url),
        "utf8",
      );

      expect(source).toContain("process.env.E2E_NTF_PASSWORD?.trim()");
      expect(source).toMatch(/if \(!PASSWORD\)[\s\S]*E2E_NTF_PASSWORD/u);
      expect(source).not.toMatch(/E2E_NTF_PASSWORD\s*\?\?/u);
    },
  );
});
