import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => {
  class PdfExportRequestError extends Error {
    code: string;
    status: number;

    constructor(message: string, code: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  return {
    assertMonthlyPdfExportLimitMock: vi.fn(),
    buildPdfDocumentMock: vi.fn(),
    fetchProfileStatusMock: vi.fn(),
    fromMock: vi.fn(),
    getUserMock: vi.fn(),
    PdfExportRequestError,
    registerPdfFontsMock: vi.fn(),
    renderToBufferMock: vi.fn(),
    resolvePdfExportItemsMock: vi.fn(),
    storageFromMock: vi.fn(),
  };
});

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: (...args: unknown[]) => helpers.renderToBufferMock(...args),
}));

vi.mock("@/lib/auth/profile", () => ({
  fetchProfileStatus: (...args: unknown[]) =>
    helpers.fetchProfileStatusMock(...args),
  isActiveStatus: (status: string | null | undefined) => status === "active",
}));

vi.mock("@/lib/export/pdf-document", () => ({
  buildPdfDocument: (...args: unknown[]) =>
    helpers.buildPdfDocumentMock(...args),
  registerPdfFonts: (...args: unknown[]) =>
    helpers.registerPdfFontsMock(...args),
}));

vi.mock("@/lib/export/pdf-export-server", () => ({
  assertMonthlyPdfExportLimit: (...args: unknown[]) =>
    helpers.assertMonthlyPdfExportLimitMock(...args),
  PdfExportRequestError: helpers.PdfExportRequestError,
  resolvePdfExportItems: (...args: unknown[]) =>
    helpers.resolvePdfExportItemsMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: { getUser: helpers.getUserMock },
      from: helpers.fromMock,
      storage: { from: helpers.storageFromMock },
    }),
}));

import { POST } from "../../../../src/app/api/export/pdf/route";

const validRequestBody = {
  sourceType: "submission",
  sourceId: "00000000-0000-0000-0000-000000000099",
  options: {
    filename: "learning-export",
    includeAnswers: true,
    includeFeedback: true,
    layout: "paged",
    orientation: "portrait",
  },
};

function postPdf(body = validRequestBody) {
  return POST(
    new Request("http://localhost/api/export/pdf", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    }) as never,
  );
}

describe("POST /api/export/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: "2026-06-29T00:00:00.000Z",
        },
      },
      error: null,
    });
    helpers.fetchProfileStatusMock.mockResolvedValue("active");
    helpers.assertMonthlyPdfExportLimitMock.mockResolvedValue(undefined);
    helpers.resolvePdfExportItemsMock.mockResolvedValue([]);
    helpers.buildPdfDocumentMock.mockReturnValue({ type: "pdf-doc" });
    helpers.renderToBufferMock.mockResolvedValue(Buffer.from("pdf"));
    helpers.storageFromMock.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    });
    helpers.fromMock.mockImplementation((table: string) => {
      if (table === "export_files") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "00000000-0000-0000-0000-000000000111" },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });
  });

  it("rejects email-unverified sessions before checking account status or export data", async () => {
    helpers.getUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    const response = await postPdf();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "email_unverified",
    });
    expect(helpers.fetchProfileStatusMock).not.toHaveBeenCalled();
    expect(helpers.assertMonthlyPdfExportLimitMock).not.toHaveBeenCalled();
    expect(helpers.fromMock).not.toHaveBeenCalled();
  });

  it("continues PDF export for verified active sessions", async () => {
    const response = await postPdf();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      exportId: "00000000-0000-0000-0000-000000000111",
      filename: "learning-export.pdf",
      storagePath: "exports/user-1/00000000-0000-0000-0000-000000000111.pdf",
    });
    expect(helpers.fetchProfileStatusMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
  });
});
