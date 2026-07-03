// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const { checkNicknameAvailabilityMock } = vi.hoisted(() => ({
  checkNicknameAvailabilityMock: vi.fn(),
}));
const { formStatusState } = vi.hoisted(() => ({
  formStatusState: { pending: false },
}));

vi.mock("@/lib/settings/mutations", () => ({
  checkNicknameAvailability: (...args: unknown[]) =>
    checkNicknameAvailabilityMock(...args),
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      pending: formStatusState.pending,
      data: null,
      method: null,
      action: null,
    }),
  };
});

import { AuthConsentPanel } from "../../../src/components/auth/AuthConsentPanel";

afterEach(() => {
  cleanup();
  checkNicknameAvailabilityMock.mockReset();
  formStatusState.pending = false;
});

describe("AuthConsentPanel", () => {
  it("renders missing consent documents and the submit action", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: "Full consent body",
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: "talkpik-abc123",
        }}
        missingProfileFields={[]}
        showRequiredError={false}
      />,
    );

    const documentCards = screen.getAllByTestId("auth-consent-document-card");
    expect(documentCards).toHaveLength(1);
    expect(documentCards[0].className).toContain("app-card");
    expect(screen.getByText("Terms of Service")).toBeTruthy();
    expect(screen.getByText("Short consent summary")).toBeTruthy();
    expect(screen.getByText("Full consent body")).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("renders consent document HTML as sanitized markup", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: `
              <style>.app-card { display: none; }</style>
              <h2 class="app-card" style="color: red">Required Terms</h2>
              <p class="ant-card" style="position: fixed">Body <strong>content</strong></p>
            `,
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: "talkpik-abc123",
        }}
        missingProfileFields={[]}
        showRequiredError={false}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Required Terms",
    });
    const legalBody = heading.closest(".legal-document-body");

    expect(legalBody).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
    expect(legalBody?.innerHTML).not.toContain("<style");
    expect(legalBody?.innerHTML).not.toContain("class=");
    expect(legalBody?.innerHTML).not.toContain("style=");
  });

  it("renders consent document Markdown as sanitized markup", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: `
              # Required Terms

              ## Article 1 Purpose

              Body includes **important consent**.

              - First consent item

              [Privacy Policy](/privacy)

              <script>alert("xss")</script>
            `,
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: "talkpik-abc123",
        }}
        missingProfileFields={[]}
        showRequiredError={false}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Required Terms",
    });
    const legalBody = heading.closest(".legal-document-body");

    expect(legalBody).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Article 1 Purpose" }),
    ).toBeTruthy();
    expect(screen.getByText("important consent")).toBeTruthy();
    expect(screen.getByText("First consent item")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href"),
    ).toBe("/privacy");
    expect(legalBody?.textContent).not.toContain("# Required Terms");
    expect(legalBody?.innerHTML).not.toContain("**important consent**");
    expect(legalBody?.innerHTML).not.toContain("<script");
    expect(legalBody?.innerHTML).not.toContain("alert");
  });

  it("renders mixed HTML and Markdown consent bodies without raw markup", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: `
              <div>## 제1조 (목적)</div>
              <br>
              이 약관은 **TALKPIK AI** 이용 조건을 규정합니다.

              - 첫 번째 항목
            `,
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: "talkpik-abc123",
        }}
        missingProfileFields={[]}
        showRequiredError={false}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "제1조 (목적)",
    });
    const legalBody = heading.closest(".legal-document-body");

    expect(legalBody).toBeTruthy();
    expect(screen.getByText("첫 번째 항목")).toBeTruthy();
    expect(legalBody?.textContent).not.toContain("<div>");
    expect(legalBody?.textContent).not.toContain("<br>");
    expect(legalBody?.textContent).not.toContain("##");
  });

  it("renders missing profile fields and required consent in one form", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: null,
            body: "Full consent body",
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: null,
          nationality_country_code: null,
          nickname: null,
        }}
        missingProfileFields={[
          "display_name",
          "nickname",
          "nationality_country_code",
        ]}
        showRequiredError={false}
        suggestedNickname="talkpik-000000"
      />,
    );

    expect(screen.getByTestId("auth-consent-card")).toBeTruthy();
    expect(screen.getByTestId("auth-consent-card").className).toContain(
      "app-card",
    );
    expect(document.querySelectorAll("form")).toHaveLength(1);
    expect(screen.getByLabelText("이름")).toBeTruthy();
    expect(screen.getByLabelText("닉네임")).toHaveProperty(
      "value",
      "talkpik-000000",
    );
    expect(screen.getByLabelText("국가/지역")).toBeTruthy();
    expect(screen.getByText("Terms of Service")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /필수 약관/ })).toBeTruthy();
  });

  it("renders only the profile fields that are missing", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: null,
        }}
        missingProfileFields={["nickname"]}
        showRequiredError={false}
      />,
    );

    expect(screen.queryByLabelText("이름")).toBeNull();
    expect(screen.getByLabelText("닉네임")).toBeTruthy();
    expect(screen.queryByLabelText("국가/지역")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows the current nickname when another required profile field is missing", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: null,
          nationality_country_code: "KR",
          nickname: "talkpik-84x2a",
        }}
        missingProfileFields={["display_name"]}
        showRequiredError={false}
      />,
    );

    expect(document.querySelector('input[name="display_name"]')).toBeTruthy();
    expect(document.querySelector('input[name="nickname"]')).toHaveProperty(
      "value",
      "talkpik-84x2a",
    );
    expect(screen.queryByTestId("country-region-select")).toBeNull();
  });

  it("renders the submit button as loading and disabled while the form action is pending", () => {
    formStatusState.pending = true;
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: "Full consent body",
          },
        ]}
        next="/auth/post-auth?intent=login"
        profile={{
          display_name: "Chan",
          nationality_country_code: "KR",
          nickname: "talkpik-abc123",
        }}
        missingProfileFields={[]}
        showRequiredError={false}
      />,
    );

    const submit = screen.getByRole("button");
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.className).toContain("ant-btn-loading");
  });
});
