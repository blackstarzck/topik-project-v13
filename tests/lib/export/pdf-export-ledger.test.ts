import { describe, expect, it, vi } from "vitest";

import { preparePdfExportLedger } from "../../../src/lib/export/pdf-export-ledger";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "../../../src/lib/export/pdf-options";

const request = {
  requestId: "33333333-3333-4333-8333-333333333333",
  sourceType: "submission",
  sourceId: "11111111-1111-4111-8111-111111111111",
  options: {
    filename: "learning-export",
    ...PDF_EXPORT_DEFAULT_OPTIONS,
  },
} as const;

function client(
  result: Record<string, unknown> | null,
  error: Record<string, unknown> | null = null,
) {
  const rpc = vi.fn().mockResolvedValue({ data: result, error });
  return { supabase: { rpc } as never, rpc };
}

describe("preparePdfExportLedger", () => {
  it("acquires a DB-generated attempt through the user JWT RPC", async () => {
    const fixture = client({
      attemptId: "77777777-7777-4777-8777-777777777777",
      exportId: "55555555-5555-4555-8555-555555555555",
      leaseExpiresAt: "2026-07-24T06:00:00.000Z",
      renderSource: "server_render",
      state: "queued",
      storagePath:
        "server-render://55555555-5555-4555-8555-555555555555/77777777-7777-4777-8777-777777777777",
    });

    await expect(
      preparePdfExportLedger(
        fixture.supabase,
        "user-1",
        request,
        "server_render",
      ),
    ).resolves.toMatchObject({
      attemptId: "77777777-7777-4777-8777-777777777777",
      exportId: "55555555-5555-4555-8555-555555555555",
      state: "queued",
    });
    expect(fixture.rpc).toHaveBeenCalledWith("acquire_pdf_export_attempt", {
      p_request_id: request.requestId,
      p_source_type: "submission",
      p_source_id: request.sourceId,
      p_request_options: {
        ...request.options,
        request_item_ids: null,
      },
      p_render_source: "server_render",
    });
  });

  it("sorts library item ids before the DB binds the request payload", async () => {
    const fixture = client({
      attemptId: "77777777-7777-4777-8777-777777777777",
      exportId: "55555555-5555-4555-8555-555555555555",
      leaseExpiresAt: "2026-07-24T06:00:00.000Z",
      renderSource: "browser_print",
      state: "queued",
      storagePath:
        "browser-print://55555555-5555-4555-8555-555555555555/77777777-7777-4777-8777-777777777777",
    });

    await preparePdfExportLedger(
      fixture.supabase,
      "user-1",
      {
        requestId: request.requestId,
        sourceType: "library_selection",
        itemIds: [
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ],
        options: request.options,
      },
      "browser_print",
    );

    expect(fixture.rpc).toHaveBeenCalledWith(
      "acquire_pdf_export_attempt",
      expect.objectContaining({
        p_request_options: expect.objectContaining({
          request_item_ids: [
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          ],
        }),
        p_source_id: null,
      }),
    );
  });

  it("returns a ready row for route-level resolve, claim, and commit verification", async () => {
    const fixture = client({
      attemptId: null,
      exportId: "55555555-5555-4555-8555-555555555555",
      leaseExpiresAt: null,
      renderSource: "server_render",
      state: "ready",
      storagePath: "exports/user-1/ready.pdf",
    });

    await expect(
      preparePdfExportLedger(
        fixture.supabase,
        "user-1",
        request,
        "server_render",
      ),
    ).resolves.toEqual({
      attemptId: null,
      exportId: "55555555-5555-4555-8555-555555555555",
      leaseExpiresAt: null,
      renderSource: "server_render",
      state: "ready",
      storagePath: "exports/user-1/ready.pdf",
    });
  });

  it("maps an active DB lease to a retry-safe 409 response", async () => {
    const fixture = client(null, {
      code: "55P03",
      message: "pdf export attempt active",
    });

    await expect(
      preparePdfExportLedger(
        fixture.supabase,
        "user-1",
        request,
        "server_render",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("maps request payload reuse to a 409 response", async () => {
    const fixture = client(null, {
      code: "22023",
      message: "pdf export request payload mismatch",
    });

    await expect(
      preparePdfExportLedger(
        fixture.supabase,
        "user-1",
        request,
        "server_render",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects malformed acquisition results", async () => {
    const fixture = client({ state: "queued" });

    await expect(
      preparePdfExportLedger(
        fixture.supabase,
        "user-1",
        request,
        "server_render",
      ),
    ).rejects.toThrow(/invalid response/);
  });
});
