// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";

import { TermsDocument } from "../../../src/components/legal/TermsDocument";
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
