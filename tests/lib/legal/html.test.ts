import { describe, expect, it } from "vitest";

import {
  renderLegalDocumentBodyHtml,
  sanitizeLegalDocumentHtml,
} from "../../../src/lib/legal/html";

describe("legal document HTML helpers", () => {
  it("sanitizes admin-authored HTML without preserving unsafe hooks", () => {
    expect(
      sanitizeLegalDocumentHtml(`
        <style>.app-card { display: none; }</style>
        <h1 class="app-card" style="color: red" onclick="alert(1)">Terms</h1>
        <p><strong>Visible body</strong></p>
        <a href="javascript:alert(1)">Unsafe</a>
      `),
    ).toContain("<h1>Terms</h1>");
  });

  it("renders Markdown legal bodies as sanitized document HTML", () => {
    const html = renderLegalDocumentBodyHtml(`
      # Published Terms

      ## Article 1 Purpose

      This policy includes **important notice** text.

      - First term item
      - Second term item

      [Privacy Policy](/privacy)

      <script>alert("xss")</script>
    `);

    expect(html).toContain("<h1>Published Terms</h1>");
    expect(html).toContain("<h2>Article 1 Purpose</h2>");
    expect(html).toContain(
      "<p>This policy includes <strong>important notice</strong> text.</p>",
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>First term item</li>");
    expect(html).toContain("<li>Second term item</li>");
    expect(html).toContain('<a href="/privacy">Privacy Policy</a>');
    expect(html).not.toContain("# Published Terms");
    expect(html).not.toContain("**important notice**");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
  });

  it("keeps unsafe Markdown link protocols out of rendered links", () => {
    const html = renderLegalDocumentBodyHtml("[Unsafe](javascript:evil)");

    expect(html).toContain("<a>Unsafe</a>");
    expect(html).not.toContain("javascript:");
  });

  it("renders mixed HTML wrappers and Markdown without leaking raw markup", () => {
    const html = renderLegalDocumentBodyHtml(`
      <div>## 제1조 (목적)</div>
      <br>
      이 약관은 **DOTORE TOPIK** 서비스 이용 조건을 규정합니다.

      - 첫 번째 항목
      - 두 번째 항목
    `);

    expect(html).toContain("<h2>제1조 (목적)</h2>");
    expect(html).toContain("<strong>DOTORE TOPIK</strong>");
    expect(html).toContain("<li>첫 번째 항목</li>");
    expect(html).toContain("<li>두 번째 항목</li>");
    expect(html).not.toContain("&lt;div&gt;");
    expect(html).not.toContain("&lt;br&gt;");
    expect(html).not.toContain("##");
  });

  it("converts Markdown headings wrapped in HTML even without other markdown cues", () => {
    const html = renderLegalDocumentBodyHtml(
      `<div>## 제1조</div>\n<div>서비스 이용 안내입니다.</div>`,
    );

    expect(html).toContain("<h2>제1조</h2>");
    expect(html).toContain("서비스 이용 안내입니다.");
    expect(html).not.toContain("##");
    expect(html).not.toContain("&lt;div&gt;");
  });

  it("passes allowed inline HTML through the Markdown path un-escaped", () => {
    const html = renderLegalDocumentBodyHtml(`
      - 항목

      약관의 <strong>중요</strong> 내용과 **강조**
    `);

    expect(html).toContain("<strong>중요</strong>");
    expect(html).toContain("<strong>강조</strong>");
    expect(html).not.toContain("&lt;strong&gt;");
  });

  it("keeps XSS vectors out of mixed HTML and Markdown bodies", () => {
    const html = renderLegalDocumentBodyHtml(`
      ## 보안 조항

      <img src=x onerror=alert(1)>

      <a href="javascript:alert(1)">클릭</a>

      <div onclick="alert(2)">본문</div>

      <script>alert(3)</script>
    `);

    expect(html).toContain("<h2>보안 조항</h2>");
    expect(html).toContain("<a>클릭</a>");
    expect(html).toContain("본문");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
  });

  it("preserves literal angle brackets inside Markdown code spans", () => {
    const html = renderLegalDocumentBodyHtml(`
      - 목록

      코드 \`1 < 2 > 0\` 표기
    `);

    expect(html).toContain("<code>1 &lt; 2 &gt; 0</code>");
  });

  it("restores nested inline tokens without leaking token markers", () => {
    const html = renderLegalDocumentBodyHtml("[링크 <b>강조</b>](/privacy)");

    expect(html).not.toContain("@@LEGAL_DOC_TOKEN");
    expect(html).toContain('<a href="/privacy">');
    expect(html).toContain("<b>강조</b>");
  });

  it("returns an empty string for null, empty, and whitespace bodies", () => {
    expect(renderLegalDocumentBodyHtml(null)).toBe("");
    expect(renderLegalDocumentBodyHtml("")).toBe("");
    expect(renderLegalDocumentBodyHtml("  \n ")).toBe("");
  });

  it("preserves pre-encoded HTML entities in Markdown/mixed bodies", () => {
    const html = renderLegalDocumentBodyHtml(`
      ## 제1조

      이용 시간은 09:00 &gt; 18:00 이며, 공백&nbsp;규칙을 따릅니다.

      - 항목 하나
    `);

    expect(html).toContain("&gt;");
    expect(html).toContain("&nbsp;");
    expect(html).not.toContain("&amp;gt;");
    expect(html).not.toContain("&amp;nbsp;");
  });

  it("still escapes a lone ampersand that is not a valid entity", () => {
    const html = renderLegalDocumentBodyHtml(`
      ## 제목

      R&D 및 A & B 관련 규정.

      - 항목
    `);

    expect(html).toContain("R&amp;D");
    expect(html).toContain("A &amp; B");
  });

  it("keeps HTML-only table bodies on the HTML path", () => {
    const html = renderLegalDocumentBodyHtml(
      `<table><tr><td colspan="2">내용</td></tr></table>`,
    );

    expect(html).toContain('colspan="2"');
    expect(html).toContain("내용");
  });
});
