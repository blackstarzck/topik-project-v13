import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TalkpikApiRequestError,
  TalkpikApiTimeoutError,
  deleteTalkpikAccountProfile,
  getTalkpikApiBaseUrl,
} from "../../../src/lib/talkpik-api/account";

describe("TalkPik account API adapter", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete process.env.TALKPIK_API_BASE_URL;
    delete process.env.TALKPIK_WRITING_API_BASE_URL;
  });

  it("normalizes the server-only TalkPik API base URL", () => {
    process.env.TALKPIK_API_BASE_URL = " https://api.example.test/ ";

    expect(getTalkpikApiBaseUrl()).toBe("https://api.example.test");
  });

  it("allows local http base URLs outside production", () => {
    process.env.TALKPIK_API_BASE_URL = "http://127.0.0.1:43117/";

    expect(getTalkpikApiBaseUrl()).toBe("http://127.0.0.1:43117");
  });

  it("keeps the legacy writing API base URL as a compatibility fallback", () => {
    process.env.TALKPIK_WRITING_API_BASE_URL = " https://legacy.example.test/ ";

    expect(getTalkpikApiBaseUrl()).toBe("https://legacy.example.test");
  });

  it("rejects insecure base URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.TALKPIK_API_BASE_URL = "http://127.0.0.1:43117";

    expect(() => getTalkpikApiBaseUrl()).toThrow(/https/);
  });

  it("sends a bearer-authenticated DELETE request without a body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await deleteTalkpikAccountProfile({
      baseUrl: "https://api.example.test/",
      accessToken: "learner-token",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/auth/profile");
    expect(init).toMatchObject({
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer learner-token",
      },
    });
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("treats a 404 as an already-deleted external profile", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("already gone", {
        status: 404,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(
      deleteTalkpikAccountProfile({
        baseUrl: "https://api.example.test",
        accessToken: "learner-token",
        fetchImpl,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([401, 500])(
    "throws a status-only error when external deletion returns %i",
    async (status) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response("do not expose this body", {
          status,
          headers: { "content-type": "text/plain" },
        }),
      );

      await expect(
        deleteTalkpikAccountProfile({
          baseUrl: "https://api.example.test",
          accessToken: "learner-token",
          fetchImpl,
        }),
      ).rejects.toMatchObject({
        name: "TalkpikApiRequestError",
        status,
      });
    },
  );

  it("aborts the external deletion request after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          expect(signal).toBeInstanceOf(AbortSignal);
          signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const deleteRequest = deleteTalkpikAccountProfile({
      baseUrl: "https://api.example.test",
      accessToken: "learner-token",
      fetchImpl,
      timeoutMs: 25,
    });

    const rejection = expect(deleteRequest).rejects.toMatchObject({
      name: "TalkpikApiTimeoutError",
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });

  it("rejects a missing access token before making a request", async () => {
    const fetchImpl = vi.fn();

    await expect(
      deleteTalkpikAccountProfile({
        baseUrl: "https://api.example.test",
        accessToken: " ",
        fetchImpl,
      }),
    ).rejects.toThrow(/accessToken/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exposes a request error type without storing the response body", () => {
    const error = new TalkpikApiRequestError(404);

    expect(error.status).toBe(404);
    expect("body" in error).toBe(false);
  });

  it("exposes a timeout error type without storing the response body", () => {
    const error = new TalkpikApiTimeoutError(25);

    expect(error.timeoutMs).toBe(25);
    expect("body" in error).toBe(false);
  });
});
