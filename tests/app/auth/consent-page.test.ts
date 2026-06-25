import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("/auth/consent page", () => {
  it("keeps Ant Design UI out of the server route page", () => {
    const source = readFileSync("src/app/auth/consent/page.tsx", "utf8");

    expect(source).not.toMatch(/from\s+["']antd["']/);
    expect(source).toContain("AuthConsentPanel");
  });

  it("loads consent documents with the same effective locale used for rendering", () => {
    const source = readFileSync("src/app/auth/consent/page.tsx", "utf8");

    expect(source).toContain("resolveLocaleForProfile");
    expect(source).toContain("const consentLocale = await resolveLocaleForProfile(profile)");
    expect(source).toContain("getMissingRequiredConsentDocuments(\n    user.id,\n    consentLocale,");
    expect(source).not.toContain("getMissingRequiredConsentDocuments(\n    user.id,\n    profile.ui_locale,");
  });
});
