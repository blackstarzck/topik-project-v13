// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NextActionBar } from "../../../src/components/feedback/NextActionBar";
import { PdfExportApiError } from "../../../src/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "../../../src/lib/export/pdf-export-errors";
import koMessages from "../../../messages/ko.json";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const exportPdfWithPrintFallbackMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("@/lib/analytics/google-analytics", () => ({
  trackApiRequestResult: vi.fn(),
  trackButtonClick: vi.fn(),
}));

vi.mock("@/lib/writing/mutations", () => ({
  useCreateComparisonReport: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/export/pdf-export-client", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/lib/export/pdf-export-client")
    >();
  return {
    ...actual,
    exportPdfWithPrintFallback: (...args: unknown[]) =>
      exportPdfWithPrintFallbackMock(...args),
  };
});

afterEach(() => {
  cleanup();
  exportPdfWithPrintFallbackMock.mockReset();
  routerPushMock.mockReset();
});

describe("NextActionBar PDF export quota notice", () => {
  it("shows quota exceeded as warning copy instead of a generic error", async () => {
    exportPdfWithPrintFallbackMock.mockRejectedValueOnce(
      new PdfExportApiError(
        429,
        "PDF 내보내기 횟수를 모두 사용했어요.",
        PDF_EXPORT_ERROR_CODES.quotaExceeded,
      ),
    );

    renderWithIntl(
      <NextActionBar
        submissionId="sub-1"
        userId="user-1"
        retryHref="/writing/short/sub-1/retry"
        nextHref="/writing/practice"
      />,
    );

    fireEvent.click(screen.getByTestId("feedback-action-pdf"));

    expect(
      await screen.findByText(koMessages.feedback.actions.pdfQuotaExceededTitle),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        koMessages.feedback.actions.pdfQuotaExceededDescription,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(koMessages.feedback.actions.pdfFailedTitle),
    ).toBeNull();
    await waitFor(() => {
      expect(
        document.querySelector(".ant-notification-notice-warning"),
      ).toBeTruthy();
    });
  });
});
