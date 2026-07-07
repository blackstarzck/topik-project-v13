export { getTalkpikApiBaseUrl } from "./base";

export class TalkpikApiRequestError extends Error {
  status: number;

  constructor(status: number) {
    super(`TalkPik API request failed with status ${status}`);
    this.name = "TalkpikApiRequestError";
    this.status = status;
  }
}

export async function deleteTalkpikAccountProfile({
  accessToken,
  baseUrl,
  fetchImpl = fetch,
}: {
  accessToken: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!accessToken.trim()) throw new Error("accessToken is required");

  const response = await fetchImpl(
    `${baseUrl.replace(/\/$/, "")}/api/auth/profile`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new TalkpikApiRequestError(response.status);
  }
}
