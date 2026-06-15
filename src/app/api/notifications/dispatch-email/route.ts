// Notification email worker — APP-SIDE Resend dispatcher.
//
// ARCHITECTURE (decided): the in-DB SQL dispatcher cannot make HTTP calls
// (pg_net not installed) and the provider API key must stay OUT of any
// assistant/LLM context. So in `live` mode the SQL dispatcher leaves email
// attempts as status='pending' (see migration 20260612190200_email_live_defer),
// and THIS route processes them: it reads RESEND_API_KEY from server env and
// calls Resend via fetch (no SDK / no extra dependency).
//
// HONESTY BOUNDARY (critical):
//   - An attempt is only marked 'sent' when Resend actually returns 2xx.
//   - When RESEND_API_KEY is absent we DO NOT send and DO NOT mark anything —
//     we return 503 resend_not_configured and leave all attempts untouched.
//
// AuthZ: this is a SERVICE worker endpoint, not a user session. The caller
// (cron) must send header `x-worker-secret` equal to NOTIFICATION_WORKER_SECRET.
// If the env var is unset, or the header is missing/mismatched → 401.
//
// runtime=nodejs: uses the service-role key + supabase auth admin API; must
// never run on the edge or be importable by client code (server-only route).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 이 라우트가 다루는 테이블은 topik-ai 소유(admin 마이그레이션 생성)라 v13의
// 생성된 Database 타입에 없다. 워커가 접근하는 컬럼만 최소 스키마로 선언해
// service-role 클라이언트를 타입 안전하게 사용한다.
type WorkerSchema = {
  public: {
    Tables: {
      notification_delivery_attempts: {
        Row: {
          id: string;
          user_id: string;
          dispatch_id: string;
          template_key: string;
          status: string;
          channel: string;
          retry_count: number;
          provider_message_id: string | null;
          error_code: string | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          status?: string;
          provider_message_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          retry_count?: number;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      notification_dispatches: {
        Row: { id: string; template_id: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_templates: {
        Row: {
          id: string;
          template_key: string;
          channel: string;
          status: string;
          subject: string | null;
          body_html: string | null;
          link_url: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type WorkerSupabaseClient = SupabaseClient<WorkerSchema, "public">;

// 한 번의 호출에서 처리할 pending email attempt 상한.
const BATCH_LIMIT = 50;
// SQL retry 캡과 동일(최대 3회). retry_count >= 3 이면 terminal(재시도 안 함).
const MAX_RETRY = 3;
// error_message 저장 길이 제한 (provider 응답 본문이 길 수 있다).
const ERROR_MESSAGE_MAX = 500;
const DEFAULT_FROM = "onboarding@resend.dev";
const DISPLAY_NAME_FALLBACK = "학습자";
const SITE_URL_FALLBACK = "https://app.talkpik.ai";

// 이메일 본문에 클릭 가능한 CTA 링크를 덧붙인다. in_app은 카드 클릭으로 link_url
// 이동이 되지만 이메일은 본문 안에 절대경로 링크가 있어야 행동 가능하다(N-EML-04).
function appendCtaLink(html: string, linkUrl: string | null): string {
  const path = (linkUrl ?? "").trim();
  if (!path) return html;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_FALLBACK).replace(
    /\/+$/,
    "",
  );
  const href = /^https?:\/\//i.test(path)
    ? path
    : `${base}/${path.replace(/^\/+/, "")}`;
  return `${html}\n<p><a href="${href}">알림 확인하기</a></p>`;
}

type PendingAttempt = {
  id: string;
  user_id: string;
  dispatch_id: string;
  template_key: string;
  retry_count: number;
};

// {{display_name}} 만 치환한다. subject/body는 템플릿 소유 콘텐츠이므로 그 외
// 가공(HTML strip 등)은 하지 않는다 — body_html은 HTML 그대로 발송한다.
function renderDisplayName(source: string | null, displayName: string | null): string {
  const name =
    displayName && displayName.trim().length > 0
      ? displayName.trim()
      : DISPLAY_NAME_FALLBACK;
  return (source ?? "").split("{{display_name}}").join(name);
}

export async function POST(request: NextRequest) {
  // 1. Worker AuthZ — env가 없거나 헤더 불일치면 401. (cron이 이 헤더로 호출.)
  const workerSecret = process.env.NOTIFICATION_WORKER_SECRET;
  const provided = request.headers.get("x-worker-secret");
  if (!workerSecret || provided !== workerSecret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 2. Provider 미구성 — 정직한 no-op. attempt를 일절 건드리지 않는다.
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { ok: false, error: "resend_not_configured" },
      { status: 503 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    // 서버 구성 오류 — 비밀은 노출하지 않고 일반 메시지만 반환.
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  // 3. service-role 클라이언트 (세션 없음). RLS 우회 — 서버 전용.
  const supabase = createClient<WorkerSchema, "public">(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );

  const fromAddress = process.env.RESEND_FROM ?? DEFAULT_FROM;

  // 4. pending email attempt 최대 N건 조회.
  const { data: attempts, error: selectError } = await supabase
    .from("notification_delivery_attempts")
    .select("id, user_id, dispatch_id, template_key, retry_count")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (selectError) {
    console.error("[dispatch-email] select pending failed", selectError.message);
    return NextResponse.json(
      { ok: false, error: "query_failed" },
      { status: 500 },
    );
  }

  const pending = (attempts ?? []) as PendingAttempt[];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const attempt of pending) {
    processed += 1;

    // 4a. 수신자 이메일 — profiles에는 email이 없으므로 auth admin으로 조회.
    const recipient = await resolveRecipientEmail(supabase, attempt.user_id);
    if (!recipient) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        "no_recipient_email",
        "could not resolve recipient email",
      );
      continue;
    }

    // 4b. 템플릿(subject/body_html) + display_name 조회.
    const content = await resolveContent(supabase, attempt);
    if (!content) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        "no_template",
        "could not resolve active email template",
      );
      continue;
    }

    const subject = renderDisplayName(content.subject, content.displayName);
    const html = appendCtaLink(
      renderDisplayName(content.bodyHtml, content.displayName),
      content.linkUrl,
    );

    // 4c. Resend 호출. 키는 절대 로깅/반환하지 않는다.
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipient,
          subject,
          html,
        }),
      });
    } catch (err) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        "fetch_error",
        err instanceof Error ? err.message : "network error",
      );
      continue;
    }

    const bodyText = await res.text();

    if (res.ok) {
      // 정직성: Resend가 2xx를 반환했을 때만 'sent'로 기록.
      let providerMessageId: string | null = null;
      try {
        providerMessageId = (JSON.parse(bodyText) as { id?: string }).id ?? null;
      } catch {
        providerMessageId = null;
      }
      const { error: updateError } = await supabase
        .from("notification_delivery_attempts")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          error_code: null,
          error_message: null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);
      if (updateError) {
        console.error(
          "[dispatch-email] mark sent failed",
          attempt.id,
          updateError.message,
        );
      }
      sent += 1;
    } else {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        String(res.status),
        bodyText.slice(0, ERROR_MESSAGE_MAX),
      );
    }
  }

  return NextResponse.json({ ok: true, processed, sent, failed });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}

// auth admin으로 user_id → email 해석. (profiles에 email 컬럼 없음.)
async function resolveRecipientEmail(
  supabase: WorkerSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

type ResolvedContent = {
  subject: string | null;
  bodyHtml: string | null;
  linkUrl: string | null;
  displayName: string | null;
};

// 템플릿 해석: dispatch_id → notification_dispatches.template_id →
// notification_templates(subject, body_html). display_name → profiles.
// dispatch 경유 해석이 실패하면 attempt.template_key로 active email 템플릿 폴백.
async function resolveContent(
  supabase: WorkerSupabaseClient,
  attempt: PendingAttempt,
): Promise<ResolvedContent | null> {
  let subject: string | null = null;
  let bodyHtml: string | null = null;
  let linkUrl: string | null = null;
  let resolved = false;

  const { data: dispatch } = await supabase
    .from("notification_dispatches")
    .select("template_id")
    .eq("id", attempt.dispatch_id)
    .maybeSingle();

  if (dispatch?.template_id) {
    const { data: template } = await supabase
      .from("notification_templates")
      .select("subject, body_html, link_url")
      .eq("id", dispatch.template_id as string)
      .maybeSingle();
    if (template) {
      subject = (template.subject as string | null) ?? null;
      bodyHtml = (template.body_html as string | null) ?? null;
      linkUrl = (template.link_url as string | null) ?? null;
      resolved = true;
    }
  }

  // 폴백: dispatch/template 경유 실패 시 template_key로 active email 템플릿.
  if (!resolved) {
    const { data: byKey } = await supabase
      .from("notification_templates")
      .select("subject, body_html, link_url")
      .eq("template_key", attempt.template_key)
      .eq("channel", "email")
      .eq("status", "active")
      .maybeSingle();
    if (!byKey) return null;
    subject = (byKey.subject as string | null) ?? null;
    bodyHtml = (byKey.body_html as string | null) ?? null;
    linkUrl = (byKey.link_url as string | null) ?? null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", attempt.user_id)
    .maybeSingle();

  return {
    subject,
    bodyHtml,
    linkUrl,
    displayName: (profile?.display_name as string | null) ?? null,
  };
}

// 실패 적용 — SQL retry 캡 미러: retry_count+1 후, 캡 미만이면 'pending'으로
// 되돌려 다음 워커 실행에서 재시도, 캡 도달이면 'failed' terminal.
async function applyFailure(
  supabase: WorkerSupabaseClient,
  attempt: PendingAttempt,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const nextRetry = (attempt.retry_count ?? 0) + 1;
  const terminal = nextRetry >= MAX_RETRY;
  const { error } = await supabase
    .from("notification_delivery_attempts")
    .update({
      // 캡 미만이면 pending으로 두어 다음 호출에서 재시도, 도달 시 failed.
      status: terminal ? "failed" : "pending",
      error_code: errorCode,
      error_message: errorMessage,
      retry_count: nextRetry,
      sent_at: null,
    })
    .eq("id", attempt.id);
  if (error) {
    console.error(
      "[dispatch-email] mark failure failed",
      attempt.id,
      error.message,
    );
  }
}
