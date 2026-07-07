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
    claimPdfExportQuotaMock: vi.fn(),
    commitPdfExportQuotaMock: vi.fn(),
    fetchProfileStatusMock: vi.fn(),
    fromMock: vi.fn(),
    getPdfExportProblemIdsMock: vi.fn((items: Array<{ problemId: string }>) =>
      items.map((item) => item.problemId),
    ),
    getUserMock: vi.fn(),
    PdfExportRequestError,
    releasePdfExportQuotaMock: vi.fn(),
    resolvePdfExportItemsMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/profile", () => ({
  fetchProfileStatus: (...args: unknown[]) =>
    helpers.fetchProfileStatusMock(...args),
  isActiveStatus: (status: string | null | undefined) => status === "active",
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
    }),
  createSupabaseServiceRoleClient: () => ({
    rpc: vi.fn(),
  }),
}));

import { POST } from "../../../../src/app/api/export/pdf/print/route";

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

function postPrintPdf(body = validRequestBody) {
  return POST(
    new Request("http://localhost/api/export/pdf/print", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    }) as never,
  );
}

describe("POST /api/export/pdf/print", () => {
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
    helpers.resolvePdfExportItemsMock.mockResolvedValue([
      { kind: "submission", problemId: "problem-1" },
    ]);
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
    helpers.fromMock.mockImplementation((table: string) => {
      if (table === "export_files") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "00000000-0000-0000-0000-000000000222" },
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

  it("creates a browser-print export only after quota is claimed", async () => {
    const response = await postPrintPdf();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      exportId: "00000000-0000-0000-0000-000000000222",
    });
    expect(helpers.claimPdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["problem-1"],
    );
    expect(helpers.commitPdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "00000000-0000-0000-0000-000000000222",
    );
  });

  it("returns quota metadata without creating a browser-print row", async () => {
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

    const response = await postPrintPdf();

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      code: "pdf_export_quota_exceeded",
      limit: 3,
      used: 3,
      remaining: 0,
    });
    expect(helpers.fromMock).not.toHaveBeenCalled();
  });

  it("releases reserved quota when browser-print export row creation fails", async () => {
    helpers.fromMock.mockImplementationOnce((table: string) => {
      if (table !== "export_files") return { insert: vi.fn() };
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "insert boom" },
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });

    const response = await postPrintPdf();

    expect(response.status).toBe(500);
    expect(helpers.commitPdfExportQuotaMock).not.toHaveBeenCalled();
    expect(helpers.releasePdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "browser_print_failed",
    );
  });

  it("releases reserved quota when browser-print quota commit fails", async () => {
    helpers.commitPdfExportQuotaMock.mockRejectedValueOnce(
      new Error("commit boom"),
    );

    const response = await postPrintPdf();

    expect(response.status).toBe(500);
    expect(helpers.releasePdfExportQuotaMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["usage-1"],
      "browser_print_failed",
    );
  });
});
