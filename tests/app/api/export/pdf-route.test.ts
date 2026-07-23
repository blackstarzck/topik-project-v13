import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => {
  class PdfExportRequestError extends Error {
    code?: string;
    details?: Record<string, unknown>;
    status: number;

    constructor(
      status: number,
      message: string,
      code?: string,
      details?: Record<string, unknown>,
    ) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }

  return {
    buildPdfDocumentMock: vi.fn(),
    claimPdfExportQuotaMock: vi.fn(),
    commitPdfExportQuotaMock: vi.fn(),
    fetchProfileStatusMock: vi.fn(),
    exportInsertMock: vi.fn(),
    exportUpdateMock: vi.fn(),
    fromMock: vi.fn(),
    getPdfExportProblemIdsMock: vi.fn((items: Array<{ problemId: string }>) =>
      items.map((item) => item.problemId),
    ),
    getUserMock: vi.fn(),
    PdfExportRequestError,
    registerPdfFontsMock: vi.fn(),
    renderToBufferMock: vi.fn(),
    releasePdfExportQuotaMock: vi.fn(),
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
  claimPdfExportQuota: (...args: unknown[]) =>
    helpers.claimPdfExportQuotaMock(...args),
  commitPdfExportQuota: (...args: unknown[]) =>
    helpers.commitPdfExportQuotaMock(...args),
  getPdfExportProblemIds: (items: Array<{ problemId: string }>) =>
    helpers.getPdfExportProblemIdsMock(items),
  PdfExportRequestError: helpers.PdfExportRequestError,
  releasePdfExportQuota: (...args: unknown[]) =>
    helpers.releasePdfExportQuotaMock(...args),
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
  createSupabaseServiceRoleClient: () => ({
    rpc: vi.fn(),
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
    helpers.claimPdfExportQuotaMock.mockResolvedValue({
      usageIds: ["usage-1"],
      limit: 3,
      used: 1,
      remaining: 2,
      resetAt: "2026-08-01T00:00:00+09:00",
      periodUnit: "month",
    });
    helpers.commitPdfExportQuotaMock.mockResolvedValue(undefined);
    helpers.releasePdfExportQuotaMock.mockResolvedValue(undefined);
    helpers.exportInsertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "00000000-0000-0000-0000-000000000111" },
          error: null,
        }),
      })),
    });
    helpers.exportUpdateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    helpers.resolvePdfExportItemsMock.mockResolvedValue([
      { kind: "submission", problemId: "problem-1" },
    ]);
    helpers.buildPdfDocumentMock.mockReturnValue({ type: "pdf-doc" });
    helpers.renderToBufferMock.mockResolvedValue(Buffer.from("pdf"));
    helpers.storageFromMock.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    });
    helpers.fromMock.mockImplementation((table: string) => {
      if (table === "export_files") {
        return {
          insert: helpers.exportInsertMock,
          update: helpers.exportUpdateMock,
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
    expect(helpers.claimPdfExportQuotaMock).not.toHaveBeenCalled();
    expect(helpers.fromMock).not.toHaveBeenCalled();
  });

  it("records a quota rejection after creating the queued export row", async () => {
    helpers.claimPdfExportQuotaMock.mockRejectedValueOnce(
      new helpers.PdfExportRequestError(
        429,
        "PDF 내보내기 횟수를 모두 사용했어요.",
        "pdf_export_quota_exceeded",
        {
          limit: 3,
          used: 3,
          remaining: 0,
          resetAt: "2026-08-01T00:00:00+09:00",
          periodUnit: "month",
        },
      ),
    );

    const response = await postPdf();

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "PDF 내보내기 횟수를 모두 사용했어요.",
      code: "pdf_export_quota_exceeded",
      limit: 3,
      used: 3,
      remaining: 0,
      resetAt: "2026-08-01T00:00:00+09:00",
      periodUnit: "month",
    });
    expect(helpers.exportInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued" }),
    );
    expect(helpers.exportUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failure_code: "quota_exceeded",
        failed_at: expect.any(String),
      }),
    );
    expect(helpers.renderToBufferMock).not.toHaveBeenCalled();
  });

  it("classifies quota service errors as technical failures", async () => {
    helpers.claimPdfExportQuotaMock.mockRejectedValueOnce(
      new Error("quota service unavailable"),
    );

    const response = await postPdf();

    expect(response.status).toBe(500);
    expect(helpers.exportUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failure_code: "quota_claim_failed",
      }),
    );
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
    expect(helpers.claimPdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["problem-1"],
    );
    expect(helpers.commitPdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "00000000-0000-0000-0000-000000000111",
    );
    expect(helpers.exportUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        failure_code: null,
        failed_at: null,
      }),
    );
  });

  it("releases reserved quota when server rendering fails", async () => {
    helpers.renderToBufferMock.mockRejectedValueOnce(new Error("render boom"));

    const response = await postPdf();

    expect(response.status).toBe(500);
    expect(helpers.commitPdfExportQuotaMock).not.toHaveBeenCalled();
    expect(helpers.releasePdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "server_render_failed",
    );
    expect(helpers.exportUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failure_code: "server_render_failed",
        failed_at: expect.any(String),
      }),
    );
  });

  it("releases reserved quota when quota commit fails after export generation", async () => {
    helpers.commitPdfExportQuotaMock.mockRejectedValueOnce(
      new Error("commit boom"),
    );

    const response = await postPdf();

    expect(response.status).toBe(500);
    expect(helpers.releasePdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "server_render_failed",
    );
  });

  it("logs submission export downloads with the submission_id column", async () => {
    const studyEventInsert = vi.fn().mockResolvedValue({ error: null });
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

      if (table === "study_events") {
        return {
          insert: studyEventInsert,
        };
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const response = await postPdf();

    expect(response.status).toBe(200);
    expect(studyEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "export_downloaded",
        submission_id: validRequestBody.sourceId,
      }),
    );
  });
});
