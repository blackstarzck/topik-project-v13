import type { FeedbackDimensionKey, QuestionNo } from "@/lib/writing/types";

type ExternalTraitScore = {
  trait?: string;
  name?: string;
  score?: number | null;
  max_score?: number | null;
  feedback?: string | null;
  comment?: string | null;
};

type ExternalAnnotation = {
  start?: number | null;
  end?: number | null;
  start_offset?: number | null;
  end_offset?: number | null;
  text?: string | null;
  suggestion?: string | null;
  annotation_type?: string | null;
  category?: string | null;
  original_text?: string | null;
  corrected_text?: string | null;
  comment?: string | null;
};

export type EvaluationFeedbackPayload = {
  feedback: {
    status: "complete";
    score_total: number;
    score_max: number;
    overall_summary: string;
    ai_model: string;
    ai_model_version: string;
  };
  dimensions: Array<{
    dimension: FeedbackDimensionKey;
    score: number;
    score_max: number;
    summary: string;
    weakness_level: number;
  }>;
  sentences: Array<{
    sentence_index: number;
    original_text: string;
    corrected_text: string;
    comment: string;
  }>;
};

export type ExternalEvaluationFeedback = {
  submission_id: string;
  status: string;
  total_score: number;
  max_score: number;
  processing_time_seconds: number;
  time_spent?: number | null;
  time_spent_seconds?: number | null;
  trait_scores: ExternalTraitScore[];
  errors: unknown[];
  model_answer?: unknown;
  combined_feedback?: unknown;
  annotations?: ExternalAnnotation[];
  ai_summary?: string | null;
  degraded?: boolean;
  degraded_traits?: string[];
};

type ExternalEvaluationStatus = {
  submission_id: string;
  status: "processing" | "graded" | "failed" | string;
  total_score?: number | null;
  max_score?: number | null;
  processing_time_seconds?: number | null;
};

export type ExternalSubmitWritingRequest = {
  task_type: string;
  // §7 question_id (= 외부 API의 question_id, GET /api/writing/tasks가 반환; 예 'topik-writing-51-0001').
  // 채점이 이 문항의 prompt/모범답안/루브릭을 사용한다. null이면 task_type의 임의 문항으로 ad-hoc 채점.
  question_id?: string | null;
  // Q51/Q52 빈칸형: 학생이 보는 라벨(ㄱ/ㄴ)→답. 백엔드가 ㄱ→blank_1로 매핑. text보다 우선.
  blanks?: Record<string, string>;
  // Q53/Q54 본문(또는 빈칸 구조가 없을 때의 폴백). blanks와 택일.
  text?: string;
  user_id?: string | null;
  lang?: string;
  // Q51/Q52: ㄱ/ㄴ 빈칸이 있는 원문 지문(DB에 없으면 프론트에서 전달; question_id가 있으면 백엔드가 로드).
  passage_context?: string;
};

export type ExternalSubmitWritingResponse = {
  submission_id: string;
  status: string;
  message: string;
};

export class ExternalEvaluationApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`External evaluation API request failed with status ${status}`);
    this.name = "ExternalEvaluationApiError";
    this.status = status;
    this.body = body;
  }
}

export function getTalkpikApiBaseUrl(): string | null {
  const raw =
    process.env.TALKPIK_API_BASE_URL?.trim() ||
    process.env.TALKPIK_WRITING_API_BASE_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("TALKPIK_API_BASE_URL must be a valid URL");
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && url.protocol !== "https:") {
    throw new Error("TALKPIK_API_BASE_URL must use https in production");
  }

  return url.toString().replace(/\/$/, "");
}

const TRAIT_TO_DIMENSION: Record<
  string,
  EvaluationFeedbackPayload["dimensions"][number]["dimension"]
> = {
  grammar: "grammar",
  vocab: "vocab",
  vocabulary: "vocab",
  structure: "structure",
  organization: "structure",
  content: "content",
  expression: "expression",
  topic_fit: "topic_fit",
  topic: "topic_fit",
};

export function toExternalTaskType(questionNo: QuestionNo): string {
  return String(questionNo).padStart(3, "0");
}

export function mapExternalEvaluationFeedback(
  input: ExternalEvaluationFeedback,
): EvaluationFeedbackPayload {
  const dimensions = input.trait_scores
    .map((trait) => {
      const key = (trait.trait ?? trait.name ?? "").toLowerCase();
      const dimension = TRAIT_TO_DIMENSION[key];
      if (!dimension) return null;
      const score = trait.score ?? null;
      return {
        dimension,
        score: score ?? 0,
        score_max: trait.max_score ?? input.max_score ?? 100,
        summary: trait.feedback ?? trait.comment ?? "",
        weakness_level: score == null ? 3 : score < 70 ? 4 : score < 85 ? 3 : 1,
      };
    })
    .filter(
      (row): row is EvaluationFeedbackPayload["dimensions"][number] =>
        row !== null,
    );

  const sentences = (input.annotations ?? []).map((annotation, index) => {
    const originalText = annotation.original_text ?? annotation.text ?? "";
    return {
      sentence_index: index,
      original_text: originalText,
      corrected_text:
        annotation.corrected_text ?? annotation.suggestion ?? originalText,
      comment: annotation.comment ?? "",
    };
  });

  return {
    feedback: {
      status: "complete",
      score_total: input.total_score,
      score_max: input.max_score,
      overall_summary: input.ai_summary ?? "",
      ai_model: "talkpik-writing-api",
      ai_model_version: input.degraded ? "degraded" : "openapi",
    },
    dimensions,
    sentences,
  };
}

export async function submitExternalWriting({
  baseUrl,
  accessToken,
  payload,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  payload: ExternalSubmitWritingRequest;
  fetchImpl?: typeof fetch;
}): Promise<ExternalSubmitWritingResponse> {
  return requestJson(`${baseUrl.replace(/\/$/, "")}/api/writing/submit`, {
    accessToken,
    method: "POST",
    body: payload,
    fetchImpl,
  }) as Promise<ExternalSubmitWritingResponse>;
}

export async function getExternalEvaluationStatus({
  baseUrl,
  accessToken,
  submissionId,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  submissionId: string;
  fetchImpl?: typeof fetch;
}): Promise<ExternalEvaluationStatus> {
  return requestJson(
    `${baseUrl.replace(/\/$/, "")}/api/evaluation/${encodeURIComponent(submissionId)}`,
    { accessToken, method: "GET", fetchImpl },
  ) as Promise<ExternalEvaluationStatus>;
}

export async function getExternalEvaluationFeedback({
  baseUrl,
  accessToken,
  submissionId,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  submissionId: string;
  fetchImpl?: typeof fetch;
}): Promise<ExternalEvaluationFeedback> {
  return requestJson(
    `${baseUrl.replace(/\/$/, "")}/api/evaluation/${encodeURIComponent(submissionId)}/feedback`,
    { accessToken, method: "GET", fetchImpl },
  ) as Promise<ExternalEvaluationFeedback>;
}

async function requestJson(
  url: string,
  {
    accessToken,
    method,
    body,
    fetchImpl,
  }: {
    accessToken: string;
    method: "GET" | "POST";
    body?: unknown;
    fetchImpl: typeof fetch;
  },
): Promise<unknown> {
  if (!accessToken.trim()) throw new Error("accessToken is required");

  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const parsed = await parseJson(response);
  if (!response.ok) {
    throw new ExternalEvaluationApiError(response.status, parsed);
  }
  return parsed;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
