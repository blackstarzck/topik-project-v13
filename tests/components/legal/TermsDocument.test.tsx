// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";

import {
  LegalDocument,
  TermsDocument,
} from "../../../src/components/legal/TermsDocument";
import type { PublishedLegalDocument } from "../../../src/lib/legal/documents";

afterEach(cleanup);

const publishedTerms: PublishedLegalDocument = {
  id: "terms-admin-1",
  doc_type: "terms",
  version: "v2026.06",
  locale: "ko",
  title: "이용약관",
  summary: "관리자 발행 약관",
  effective_at: "2026-06-22T00:00:00.000Z",
  is_placeholder: false,
  body: `
    <h1>관리자 발행 이용약관</h1>
    <p><strong>중요 안내</strong>를 확인해주세요.</p>
    <ul><li>첫 번째 약관 항목</li></ul>
  `,
};

const publishedPrivacy: PublishedLegalDocument = {
  ...publishedTerms,
  id: "privacy-admin-1",
  doc_type: "privacy",
  title: "개인정보처리방침",
  summary: "관리자 발행 개인정보처리방침",
  body: `
    # Published Privacy

    ## Article 1 Personal Data

    This policy includes **privacy notice** text.
  `,
};

function renderTermsDocument(doc: PublishedLegalDocument = publishedTerms) {
  return render(
    <AntdApp>
      <TermsDocument doc={doc} />
    </AntdApp>,
  );
}

describe("TermsDocument", () => {
  it("renders admin-authored HTML as document markup inside the legal card layout", () => {
    renderTermsDocument();

    const card = screen.getByTestId("terms-card");
    expect(card.classList.contains("legal-document-card")).toBe(true);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "관리자 발행 이용약관",
      }),
    ).toBeTruthy();
    expect(screen.getByText("중요 안내")).toBeTruthy();
    expect(screen.getByText("첫 번째 약관 항목")).toBeTruthy();
    expect(screen.getByTestId("terms-document-body").textContent).not.toContain(
      "<strong>",
    );
  });

  it("renders the published title as the page heading when the body has no h1", () => {
    renderTermsDocument({
      ...publishedTerms,
      title: "Official Terms",
      body: "<p>Official terms body.</p>",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Official Terms" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Official terms body.")).toBeTruthy();
  });

  it("replaces an empty body h1 with the published accessible title", () => {
    renderTermsDocument({
      ...publishedTerms,
      title: "Official Terms",
      body: "<h1><span>&nbsp;</span></h1><p>Official terms body.</p>",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Official Terms" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("treats encoded and zero-width whitespace headings as empty", () => {
    renderTermsDocument({
      ...publishedTerms,
      title: "Official Terms",
      body: "<h1>&ensp;&#32;&#x200B;\u2060</h1><p>Official terms body.</p>",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Official Terms" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("treats directional marks and soft hyphens in named entities as empty", () => {
    renderTermsDocument({
      ...publishedTerms,
      title: "Official Terms",
      body: "<h1>&lrm;&rlm;&shy;</h1><p>Official terms body.</p>",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Official Terms" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders admin-authored Markdown as document markup inside the legal card layout", () => {
    renderTermsDocument({
      ...publishedTerms,
      body: `
        # Published Terms

        ## Article 1 Purpose

        This policy includes **important notice** text.

        - First term item
        - Second term item

        [Privacy Policy](/privacy)

        <script>alert("xss")</script>
      `,
    });

    const body = screen.getByTestId("terms-document-body");

    expect(
      screen.getByRole("heading", { level: 1, name: "Published Terms" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Article 1 Purpose" }),
    ).toBeTruthy();
    expect(screen.getByText("important notice")).toBeTruthy();
    expect(screen.getByText("First term item")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href"),
    ).toBe("/privacy");
    expect(body.textContent).not.toContain("# Published Terms");
    expect(body.innerHTML).not.toContain("**important notice**");
    expect(body.innerHTML).not.toContain("<script");
    expect(body.innerHTML).not.toContain("alert");
  });

  it("supports privacy document test ids while using the same Markdown renderer", () => {
    render(
      <AntdApp>
        <LegalDocument doc={publishedPrivacy} testIdPrefix="privacy" />
      </AntdApp>,
    );

    expect(screen.getByTestId("privacy-card")).toBeTruthy();
    expect(screen.getByTestId("privacy-version")).toBeTruthy();
    expect(screen.getByTestId("privacy-document-body")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Published Privacy" }),
    ).toBeTruthy();
    expect(screen.getByText("privacy notice")).toBeTruthy();
    expect(screen.queryByTestId("terms-document-body")).toBeNull();
  });

  it("renders admin-authored mixed HTML and Markdown as document markup", () => {
    renderTermsDocument({
      ...publishedTerms,
      body: `
        <div>## 제1조 (목적)</div>
        <br>
        이 약관은 **DOTORE TOPIK** 서비스 이용 조건을 규정합니다.

        - 첫 번째 항목
        - 두 번째 항목
      `,
    });

    const body = screen.getByTestId("terms-document-body");

    expect(
      screen.getByRole("heading", { level: 2, name: "제1조 (목적)" }),
    ).toBeTruthy();
    expect(screen.getByText("첫 번째 항목")).toBeTruthy();
    expect(body.textContent).not.toContain("<div>");
    expect(body.textContent).not.toContain("<br>");
    expect(body.textContent).not.toContain("##");
  });

  it("strips admin HTML hooks that can collide with app styling", () => {
    renderTermsDocument({
      ...publishedTerms,
      body: `
        <style>.app-card { display: none; }</style>
        <h1 class="app-card ant-btn" style="color: red" onclick="alert(1)">Styled Terms</h1>
        <p class="brand-logo" style="position: fixed"><strong>Visible body</strong></p>
        <a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a>
        <a class="ant-btn" href="/privacy" style="font-size: 100px">Privacy</a>
      `,
    });

    const body = screen.getByTestId("terms-document-body");

    expect(
      screen.getByRole("heading", { level: 1, name: "Styled Terms" }),
    ).toBeTruthy();
    expect(screen.getByText("Visible body")).toBeTruthy();
    expect(body.innerHTML).not.toContain("<style");
    expect(body.innerHTML).not.toContain("class=");
    expect(body.innerHTML).not.toContain("style=");
    expect(body.innerHTML).not.toContain("onclick");
    expect(body.innerHTML).not.toContain("javascript:");
    expect(screen.getByText("Unsafe").getAttribute("href")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Privacy" }).getAttribute("href"),
    ).toBe("/privacy");
  });
});
