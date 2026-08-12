import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ALLOWED_LINK_ATTRIBUTE_VALUES = Object.freeze({
  href: "{{ .ConfirmationURL }}",
  src: "{{ .SiteURL }}/assets/logo.png",
});
const LINK_ATTRIBUTE_MENTION = /(?<![\w:-])(?:href|src)\b/giu;
const QUOTED_LINK_ATTRIBUTE =
  /(?<![\w:-])(href|src)\s*=\s*(["'])([^"'<>]*)\2/giu;

function inspectTemplateLinkAttributes(source) {
  const mentionCount = source.match(LINK_ATTRIBUTE_MENTION)?.length ?? 0;
  const attributes = [...source.matchAll(QUOTED_LINK_ATTRIBUTE)].map(
    (match) => ({ name: match[1].toLowerCase(), value: match[3] }),
  );
  const confirmationCount = attributes.filter(
    ({ name, value }) =>
      name === "href" && value === ALLOWED_LINK_ATTRIBUTE_VALUES.href,
  ).length;
  const siteLogoCount = attributes.filter(
    ({ name, value }) =>
      name === "src" && value === ALLOWED_LINK_ATTRIBUTE_VALUES.src,
  ).length;

  return {
    confirmationCount,
    hasUnsafeAttribute:
      attributes.length !== mentionCount ||
      attributes.some(
        ({ name, value }) => ALLOWED_LINK_ATTRIBUTE_VALUES[name] !== value,
      ),
    siteLogoCount,
  };
}

describe("auth email template assets", () => {
  it.each([
    '<a href="https://custom.example.test/confirm">confirm</a>',
    '<a href="https%3A%2F%2Fcustom.example.test%2Fconfirm">confirm</a>',
    '<a href="java&#9;script:alert(1)">confirm</a>',
    '<a href="java&#x09;script:alert(1)">confirm</a>',
    '<a href="java&Tab;script:alert(1)">confirm</a>',
    '<a href="java\nscript:alert(1)">confirm</a>',
    '<a href="java\rscript:alert(1)">confirm</a>',
    '<a href="%6A%61%76%61%73%63%72%69%70%74%3Aalert(1)">confirm</a>',
    '<a href="custom:confirm">confirm</a>',
    '<img src="data:image/png;base64,unsafe">',
    '<a href="javascript:alert(1)">confirm</a>',
    '<a href="//custom.example.test/confirm">confirm</a>',
    '<a href="/unexpected-relative">confirm</a>',
    '<a href={{ .ConfirmationURL }}>confirm</a>',
    '<a href="{{ .ConfirmationURL }}\'>confirm</a>',
    '<img SRC=="{{ .SiteURL }}/assets/logo.png">',
  ])("rejects a non-allowlisted or malformed href/src attribute", (source) => {
    expect(inspectTemplateLinkAttributes(source).hasUnsafeAttribute).toBe(
      true,
    );
  });

  it("accepts case-insensitive attribute names and either quote style", () => {
    const source = `
      <A HREF='{{ .ConfirmationURL }}'>confirm</A>
      <a HrEf="{{ .ConfirmationURL }}">fallback</a>
      <IMG SrC='{{ .SiteURL }}/assets/logo.png'>
    `;

    expect(inspectTemplateLinkAttributes(source)).toEqual({
      confirmationCount: 2,
      hasUnsafeAttribute: false,
      siteLogoCount: 1,
    });
  });

  it("uses only the two required template-variable attribute values", () => {
    const template = readFileSync(
      path.join(process.cwd(), "auth-email-template.html"),
      "utf8",
    );
    const contract = inspectTemplateLinkAttributes(template);

    expect(contract.hasUnsafeAttribute).toBe(false);
    expect(contract.confirmationCount).toBeGreaterThan(0);
    expect(contract.siteLogoCount).toBeGreaterThan(0);
  });
});
