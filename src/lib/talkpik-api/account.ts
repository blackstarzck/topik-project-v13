export { getTalkpikApiBaseUrl } from "./base";

export const TALKPIK_ACCOUNT_DELETE_TIMEOUT_MS = 10_000;

export class TalkpikApiRequestError extends Error {
  status: number;

  constructor(status: number) {
    super(`TalkPik API request failed with status ${status}`);
    this.name = "TalkpikApiRequestError";
    this.status = status;
  }
}

export class TalkpikApiTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`TalkPik API request timed out after ${timeoutMs}ms`);
    this.name = "TalkpikApiTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function deleteTalkpikAccountProfile({
  accessToken,
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = TALKPIK_ACCOUNT_DELETE_TIMEOUT_MS,
}: {
  accessToken: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<void> {
  if (!accessToken.trim()) throw new Error("accessToken is required");

  const controller = timeoutMs > 0 ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (
      typeof timeoutId === "object" &&
      timeoutId !== null &&
      "unref" in timeoutId
    ) {
      (timeoutId as { unref: () => void }).unref();
    }
  }

  let response: Response;
  try {
    response = await fetchImpl(
      `${baseUrl.replace(/\/$/, "")}/api/auth/profile`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller?.signal,
      },
    );
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new TalkpikApiTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new TalkpikApiRequestError(response.status);
  }
}
