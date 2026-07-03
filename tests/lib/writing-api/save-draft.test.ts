import { describe, expect, it } from "vitest";

import {
  ExternalWritingApiError,
  saveExternalWritingDraft,
} from "@/lib/writing-api/save-draft";

const payload = {
  task_type: "Q54",
  task_id: "task-54",
  text: "draft body",
};

describe("saveExternalWritingDraft", () => {
  it("posts the draft with a bearer token and JSON body", async () => {
    const calls: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(new Request(input, init));

      return Response.json({
        submission_id: "draft-1",
        saved_at: "2026-06-17T10:00:00.000Z",
        character_count: 10,
      });
    };

    const result = await saveExternalWritingDraft({
      baseUrl: "https://api.example.test",
      accessToken: "access-token",
      payload,
      fetchImpl,
    });

    expect(result.submission_id).toBe("draft-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.example.test/api/writing/save-draft",
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.get("authorization")).toBe("Bearer access-token");
    expect(calls[0].headers.get("content-type")).toBe("application/json");
    await expect(calls[0].json()).resolves.toEqual(payload);
  });

  it("refuses to call the API without an access token", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return Response.json({});
    };

    await expect(
      saveExternalWritingDraft({
        baseUrl: "https://api.example.test",
        accessToken: " ",
        payload,
        fetchImpl,
      }),
    ).rejects.toThrow("accessToken is required");
    expect(called).toBe(false);
  });

  it("throws a typed error when the API rejects the request", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({ detail: "Not authenticated" }, { status: 401 });

    await expect(
      saveExternalWritingDraft({
        baseUrl: "https://api.example.test",
        accessToken: "expired-token",
        payload,
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: "ExternalWritingApiError",
      status: 401,
      body: { detail: "Not authenticated" },
    } satisfies Partial<ExternalWritingApiError>);
  });
});
