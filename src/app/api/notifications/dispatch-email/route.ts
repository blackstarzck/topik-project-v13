// Notification email worker — APP-SIDE SMTP dispatcher (Daou Office).
//
// ARCHITECTURE (decided): the in-DB SQL dispatcher cannot make network calls
// (pg_net not installed) and SMTP credentials must stay OUT of any assistant/LLM
// context. So in `live` mode the SQL dispatcher leaves email attempts as
// status='pending' (see migration 20260612190200_email_live_defer), and an
// app-side worker processes them: it reads SMTP_* from server env and sends via
// nodemailer (Daou Office outbound SMTP). keduall.com SPF already includes
// _spf.daouoffice.com, so guest@keduall.com is SPF-aligned for any recipient.
//
// HONESTY BOUNDARY (critical):
//   - An attempt is only marked 'sent' when the SMTP send resolves successfully.
//   - When SMTP is not configured we DO NOT send and DO NOT mark anything —
//     we return 503 smtp_not_configured and leave all attempts untouched.
//
// AuthZ: this is a SERVICE worker endpoint, not a user session. The caller
// (cron) must send header `x-worker-secret` equal to NOTIFICATION_WORKER_SECRET.
// If the env var is unset, or the header is missing/mismatched → 401.
//
// runtime=nodejs: uses the service-role key + supabase auth admin API + nodemailer;
// must never run on the edge or be importable by client code (server-only route).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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
          class: string | null;
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
      user_marketing_consent: {
        Row: { user_id: string; unsubscribe_token: string };
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
// 발신 주소(기본값). 오너 결정(2026-06-22): Daou Office SMTP로 발송.
// keduall.com SPF가 이미 _spf.daouoffice.com을 포함하므로 guest@keduall.com 발신은
// SPF 정렬되어 임의 수신자에게 배달된다(별도 도메인 인증 불필요). env SMTP_FROM 으로 override.
const DEFAULT_FROM = "도토리 토픽 <guest@keduall.com>";
const DISPLAY_NAME_FALLBACK = "학습자";
const SITE_URL_FALLBACK = "https://www.dotoretopik.com";

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

// 마케팅 class 이메일에는 동작하는 수신거부 링크를 본문에 덧붙인다(법적 요건,
// N-EML-07). 토큰은 user_marketing_consent.unsubscribe_token에서 해석한다. 토큰을
// 못 찾으면 (자격상 마케팅이 발송될 수 없는 상태이므로 정상 경로에선 발생하지
// 않는다) 링크를 붙이지 않고 원문을 반환한다 — 깨진 링크를 넣지 않는다.
export function appendUnsubscribeLink(
  html: string,
  token: string | null,
): string {
  const tok = (token ?? "").trim();
  if (!tok) return html;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_FALLBACK).replace(
    /\/+$/,
    "",
  );
  const href = `${base}/api/notifications/unsubscribe?token=${encodeURIComponent(tok)}`;
  return `${html}\n<p style="font-size:12px;color:#888"><a href="${href}">수신거부</a></p>`;
}

// 수신자의 unsubscribe_token 해석. user_marketing_consent에 행이 없으면 null.
async function resolveUnsubscribeToken(
  supabase: WorkerSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_marketing_consent")
    .select("unsubscribe_token")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.unsubscribe_token as string | null) ?? null;
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
function renderDisplayName(
  source: string | null,
  displayName: string | null,
): string {
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

  // 2. SMTP 미구성 — 정직한 no-op. attempt를 일절 건드리지 않는다.
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json(
      { ok: false, error: "smtp_not_configured" },
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

  const fromAddress = process.env.SMTP_FROM ?? DEFAULT_FROM;
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 = implicit TLS
    auth: { user: smtpUser, pass: smtpPass },
  });

  // 4. pending email attempt 최대 N건 조회.
  const { data: attempts, error: selectError } = await supabase
    .from("notification_delivery_attempts")
    .select("id, user_id, dispatch_id, template_key, retry_count")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (selectError) {
    console.error(
      "[dispatch-email] select pending failed",
      selectError.message,
    );
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
    let html = appendCtaLink(
      renderDisplayName(content.bodyHtml, content.displayName),
      content.linkUrl,
    );

    // 마케팅 class 이메일만 수신거부 링크를 본문에 덧붙인다(N-EML-07).
    if (content.templateClass === "marketing") {
      const token = await resolveUnsubscribeToken(supabase, attempt.user_id);
      html = appendUnsubscribeLink(html, token);
    }

    // 4c. SMTP 전송(nodemailer). 자격증명은 절대 로깅/반환하지 않는다.
    // 정직성: 전송이 성공(resolve)했을 때만 'sent'로 기록.
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        html,
      });
      const { error: updateError } = await supabase
        .from("notification_delivery_attempts")
        .update({
          status: "sent",
          provider_message_id: info.messageId ?? null,
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
    } catch (err) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        "smtp_error",
        err instanceof Error
          ? err.message.slice(0, ERROR_MESSAGE_MAX)
          : "smtp send error",
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

// 수신자 모델(오너 결정 2026-06-12): **가입 사용자만** 발송 대상이다. 수신 이메일은
// 항상 가입 계정 이메일(auth.users.email)로만 해석하며, 관리자가 임의 이메일을
// 입력해 보내는 경로는 두지 않는다(발송 대상은 notification_groups의 가입 사용자
// id로만 산정). 따라서 여기서 user_id로 계정 이메일을 조회하는 것이 유일한 경로다.
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
  templateClass: string | null;
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
  let templateClass: string | null = null;
  let resolved = false;

  const { data: dispatch } = await supabase
    .from("notification_dispatches")
    .select("template_id")
    .eq("id", attempt.dispatch_id)
    .maybeSingle();

  if (dispatch?.template_id) {
    const { data: template } = await supabase
      .from("notification_templates")
      .select("subject, body_html, link_url, class")
      .eq("id", dispatch.template_id as string)
      .maybeSingle();
    if (template) {
      subject = (template.subject as string | null) ?? null;
      bodyHtml = (template.body_html as string | null) ?? null;
      linkUrl = (template.link_url as string | null) ?? null;
      templateClass = (template.class as string | null) ?? null;
      resolved = true;
    }
  }

  // 폴백: dispatch/template 경유 실패 시 template_key로 active email 템플릿.
  if (!resolved) {
    const { data: byKey } = await supabase
      .from("notification_templates")
      .select("subject, body_html, link_url, class")
      .eq("template_key", attempt.template_key)
      .eq("channel", "email")
      .eq("status", "active")
      .maybeSingle();
    if (!byKey) return null;
    subject = (byKey.subject as string | null) ?? null;
    bodyHtml = (byKey.body_html as string | null) ?? null;
    linkUrl = (byKey.link_url as string | null) ?? null;
    templateClass = (byKey.class as string | null) ?? null;
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
    templateClass,
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
