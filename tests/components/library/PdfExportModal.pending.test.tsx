// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfExportModal } from "../../../src/components/library/PdfExportModal";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const exportPdfWithPrintFallbackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/export/pdf-export-client", () => ({
  exportPdfWithPrintFallback: (...args: unknown[]) =>
    exportPdfWithPrintFallbackMock(...args),
}));

afterEach(() => {
  cleanup();
  exportPdfWithPrintFallbackMock.mockReset();
});

describe("PdfExportModal pending UI", () => {
  it("runs the PDF generation only once while the primary CTA is pending", async () => {
    exportPdfWithPrintFallbackMock.mockReturnValue(
      new Promise(() => undefined),
    );
    renderWithIntl(
      <PdfExportModal
        open
        onClose={() => undefined}
        selection={[{ itemId: "item-1", title: "Problem abcd1234" }]}
      />,
    );

    fireEvent.click(screen.getByTestId("pdf-export-privacy-confirm"));
    const submit = screen.getByTestId("pdf-export-submit");
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(exportPdfWithPrintFallbackMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(submit).toHaveProperty("disabled", true);
    });
  });
});
