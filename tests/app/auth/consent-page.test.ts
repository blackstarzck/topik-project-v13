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

  it("checks email verification before loading consent documents", () => {
    const source = readFileSync("src/app/auth/consent/page.tsx", "utf8");

    expect(source).toContain("requireVerifiedActiveSession");
    expect(source).not.toContain("requireActiveSession");
    expect(source.indexOf("requireVerifiedActiveSession")).toBeLessThan(
      source.indexOf("getMissingRequiredConsentDocuments"),
    );
  });

  it("uses the default page container width for readable legal documents", () => {
    const source = readFileSync("src/app/auth/consent/page.tsx", "utf8");

    expect(source).toContain('<PageContainer size="default">');
    expect(source).not.toContain('<PageContainer size="narrow">');
  });
});
