import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const termsPage = readFileSync(
  join(process.cwd(), "src", "app", "terms", "page.tsx"),
  "utf8",
);
const privacyPage = readFileSync(
  join(process.cwd(), "src", "app", "privacy", "page.tsx"),
  "utf8",
);

function blockFor(selector: string): string {
  const escaped = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+")
    .replace(/>/g, "\\s*>\\s*");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("Legal document layout", () => {
  test("terms page uses the legal container width contract", () => {
    expect(termsPage).toContain(
      '<PageContainer size="default" className="legal-page-container">',
    );
    expect(blockFor(".legal-page-container")).toContain("max-width: 960px");
    expect(blockFor(".legal-page-container")).toContain("padding-inline: 0");
  });

  test("legal document card fills the 960px container", () => {
    expect(blockFor(".legal-page-container>.legal-document-card")).toContain(
      "width: 100%",
    );
  });

  test("privacy page uses the same legal container width contract", () => {
    expect(privacyPage).toContain(
      '<PageContainer size="default" className="legal-page-container">',
    );
  });

  test("privacy page reads the published privacy document before falling back to placeholder content", () => {
    expect(privacyPage).toContain(
      'getPublishedLegalDocument("privacy", locale)',
    );
    expect(privacyPage).toContain(
      '<LegalDocument doc={doc} testIdPrefix="privacy" />',
    );
  });
});
