import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { triggerPdfExport } from "../../../src/lib/export/pdf-export";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "../../../src/lib/export/pdf-options";

const request = {
  sourceType: "submission",
  sourceId: "sub-1",
  options: {
    filename: "DOTORE-TOPIK-export",
    ...PDF_EXPORT_DEFAULT_OPTIONS,
  },
} as const;

const originalWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  (globalThis as { window?: { print: () => void } }).window = {
    print: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

function response(status: number, body: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("triggerPdfExport", () => {
  it("reserves print export quota through the server endpoint before printing", async () => {
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    const fetcher = vi.fn(async () => response(200, { exportId: "exp-1" }));
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      /* noop */
    });

    await expect(triggerPdfExport(request, fetcher as never)).resolves.toEqual({
      exportId: "exp-1",
    });

    expect(fetcher).toHaveBeenCalledWith("/api/export/pdf/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, requestId }),
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("does not open the print dialog when the server print endpoint rejects", async () => {
    const fetcher = vi.fn(async () =>
      response(429, {
        error: "PDF export quota exceeded",
        code: "pdf_export_quota_exceeded",
      }),
    );
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      /* noop */
    });

    await expect(triggerPdfExport(request, fetcher as never)).rejects.toThrow(
      /PDF export quota exceeded/,
    );
    expect(printSpy).not.toHaveBeenCalled();
  });

  it("is SSR-safe and skips window.print when window is unavailable", async () => {
    delete (globalThis as { window?: unknown }).window;
    const fetcher = vi.fn(async () => response(200, { exportId: "exp-1" }));

    await expect(triggerPdfExport(request, fetcher as never)).resolves.toEqual({
      exportId: "exp-1",
    });
  });
});
