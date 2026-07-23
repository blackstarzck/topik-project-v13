import {
  isSameOriginSystemReportRequest,
  isSystemReportIdempotencyKey,
  parseSystemReportRequestBody,
  validateSystemReportRequest,
  type SystemReportResponse,
} from "@/lib/system-reports";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

const REFERENCE_CODE_PATTERN = /^SR-[0-9A-F]{16}$/;

function jsonError(status: 400 | 413 | 503) {
  const error =
    status === 413
      ? "payload_too_large"
      : status === 503
        ? "service_unavailable"
        : "invalid_request";
  return Response.json({ error }, { status });
}

function appVersion(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) || null;
}

async function authenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginSystemReportRequest(request)) return jsonError(400);

  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") return jsonError(400);

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!isSystemReportIdempotencyKey(idempotencyKey)) return jsonError(400);

  const parsedBody = await parseSystemReportRequestBody(request);
  if (!parsedBody.ok) return jsonError(parsedBody.status);

  const validated = validateSystemReportRequest(parsedBody.value);
  if (!validated.ok) return jsonError(400);

  const userId = await authenticatedUserId();
  const { category, email, title, message, context } = validated.value;

  try {
    const serviceSupabase = createSupabaseServiceRoleClient();
    const { data, error } = await serviceSupabase.rpc("submit_system_report", {
      p_idempotency_key: idempotencyKey!,
      p_user_id: userId,
      p_category: category,
      p_email: email,
      p_title: title,
      p_message: message,
      p_pathname: context.pathname,
      p_browser: context.browser,
      p_os: context.os,
      p_device_type: context.deviceType,
      p_viewport_width: context.viewportWidth,
      p_viewport_height: context.viewportHeight,
      p_locale: context.locale,
      p_app_version: appVersion(),
    });

    const result = data?.[0];
    if (
      error ||
      !result ||
      typeof result.reference_code !== "string" ||
      !REFERENCE_CODE_PATTERN.test(result.reference_code) ||
      typeof result.created_at !== "string" ||
      typeof result.inserted !== "boolean"
    ) {
      return jsonError(503);
    }

    const response: SystemReportResponse = {
      referenceCode: result.reference_code,
      createdAt: result.created_at,
    };
    return Response.json(response, { status: result.inserted ? 201 : 200 });
  } catch {
    return jsonError(503);
  }
}
