export type ExternalSaveDraftRequest = {
  task_type: string;
  task_id: string;
  text: string;
};

export type ExternalSaveDraftResponse = {
  submission_id: string;
  saved_at?: string;
  character_count?: number;
};

export class ExternalWritingApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`External writing API request failed with status ${status}`);
    this.name = "ExternalWritingApiError";
    this.status = status;
    this.body = body;
  }
}

export async function saveExternalWritingDraft({
  baseUrl,
  accessToken,
  payload,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  payload: ExternalSaveDraftRequest;
  fetchImpl?: typeof fetch;
}): Promise<ExternalSaveDraftResponse> {
  if (!accessToken.trim()) {
    throw new Error("accessToken is required");
  }

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/writing/save-draft`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJson(response);

  if (!response.ok) {
    throw new ExternalWritingApiError(response.status, body);
  }

  return body as ExternalSaveDraftResponse;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
