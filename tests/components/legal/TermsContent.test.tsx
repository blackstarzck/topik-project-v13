// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { TermsContent } from "../../../src/components/legal/TermsContent";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

// This project does not enable testing-library auto-cleanup; unmount between
// cases or repeated renders of the same component accumulate in the DOM.
afterEach(cleanup);

// TermsContent is a client component using useTranslations("legal.terms").
// renderWithIntl wraps it in NextIntlClientProvider loading the REAL ko catalog,
// so these verbatim-ko assertions go green AFTER the coordinator merges
// messages/_staging/legal.json into messages/ko.json. NEVER import _staging here.

describe("TermsContent i18n (legal.terms)", () => {
  it("renders the heading and placeholder notice from the legal.terms namespace", () => {
    renderWithIntl(<TermsContent />);
    expect(
      screen
        .getByTestId("terms-card")
        .classList.contains("legal-document-card"),
    ).toBe(true);
    expect(screen.getByText("이용약관")).toBeTruthy();
    expect(
      screen.getByText(
        "현재 문구는 법무 검토 전 placeholder이며, 확정된 법적 효력을 갖는 약관이 아닙니다.",
      ),
    ).toBeTruthy();
  });

  it("renders the provisional summary list items", () => {
    renderWithIntl(<TermsContent />);
    expect(screen.getByText("임시 안내")).toBeTruthy();
    expect(
      screen.getByText("본 서비스는 TOPIK 글쓰기 학습을 보조하는 도구입니다."),
    ).toBeTruthy();
    expect(
      screen.getByText("학습 데이터는 학습 품질 개선 목적에만 사용됩니다."),
    ).toBeTruthy();
  });

  it("renders the privacy link with the migrated link text", () => {
    renderWithIntl(<TermsContent />);
    // §2 summaryPrivacy resolves the <privacyLink> chunk to /privacy.
    // §4 escape-link region links home / back-to-sign-up / privacy.
    const privacyLinks = screen.getAllByRole("link", {
      name: "개인정보처리방침",
    });
    expect(privacyLinks.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "가입으로 돌아가기" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "홈" })).toBeTruthy();
  });

  it("renders the contact section", () => {
    renderWithIntl(<TermsContent />);
    expect(screen.getByText("문의")).toBeTruthy();
  });
});
