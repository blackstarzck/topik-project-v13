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
});
