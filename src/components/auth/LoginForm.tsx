"use client";

import { useState } from "react";
import { App, Alert, Button, Form, Input, Segmented, Typography } from "antd";
import type { FormInstance } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { REASON_CONTENT, mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

// description §1 예외 + §4 예외: 세션 만료 / 휴면 / 탈퇴 등은 인라인 안내(Alert)로.
// reason query 로 진입했을 때 보여줄 안내 문구 + 안내 톤(type).
type NoticeTone = "warning" | "info" | "error";
type StatusNotice = { tone: NoticeTone; text: string };

const REASON_NOTICE: Record<string, StatusNotice> = {
  session_expired: {
    tone: "warning",
    text: "세션이 만료되어 로그아웃됐어요. 다시 로그인해주세요.",
  },
  dormant: {
    tone: "info",
    text: "오랜만이에요! 휴면 상태였던 계정이에요. 로그인하면 다시 활성화돼요.",
  },
  withdrawn: {
    tone: "error",
    text: "탈퇴 처리된 계정이에요. 다시 이용하시려면 새로 가입해주세요.",
  },
};

// 서버에서 받은 인증 실패 코드를 "필드 하단 인라인 오류"로 보여줄지,
// "카드 상단 인라인 안내(Alert)"로 보여줄지 분류한다 (description §3 vs §4).
const FIELD_LEVEL_CODES = new Set([
  "invalid_credentials",
  "invalid_login_credentials",
  "validation_failed",
]);

const STATUS_NOTICE_BY_CODE: Record<string, StatusNotice> = {
  email_not_confirmed: {
    tone: "warning",
    text: "이메일 인증이 아직 완료되지 않았어요. 받은편지함의 인증 메일을 확인해주세요.",
  },
  user_banned: {
    tone: "error",
    text: "이용이 제한된 계정이에요. 자세한 내용은 고객센터로 문의해주세요.",
  },
  // 서버/네트워크 계열은 별도 분기에서 처리하지만, 명시적 fallback 도 준비.
};

type LoginMode = "password" | "magic-link";

type PasswordFields = { email: string; password: string };
type MagicLinkFields = { email: string };

// Codex P4 D5 결정: 잠금은 서버 강제 (Supabase over_request_rate_limit → X-11 카드).
// 클라이언트는 보안 장치가 아닌 사용자 안내용 실패 카운터만 둠. 우회 가능해도 보안에
// 영향 없음. 사용자가 "다시 시도해도 안 될 수 있다" 는 신호를 미리 받게 함.
const FAILED_ATTEMPTS_HINT_THRESHOLD = 3;

export function LoginForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeReason = searchParams.get("reason");
  // §1/§4 예외: reason query 기반 인라인 안내 (세션 만료/휴면/탈퇴).
  const queryNotice = noticeReason ? REASON_NOTICE[noticeReason] : undefined;
  const [mode, setMode] = useState<LoginMode>("password");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  // 로그인 시도 후 서버가 돌려준 상태성 오류(휴면/미인증/서버오류)를 위한 인라인 안내.
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [form] = Form.useForm<PasswordFields | MagicLinkFields>();

  // 화면 상단에 노출할 최종 안내: 시도 후 statusNotice가 query 안내보다 우선.
  const activeNotice = statusNotice ?? queryNotice ?? null;

  async function handlePasswordLogin(values: PasswordFields) {
    setSubmitting(true);
    setStatusNotice(null);
    const supabase = createSupabaseBrowserClient();
    let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      result = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
    } catch {
      // 네트워크/서버 오류 — §4 예외: 서버 오류 인라인 안내.
      setSubmitting(false);
      setFailedAttempts((prev) => prev + 1);
      setStatusNotice({
        tone: "error",
        text: "지금 로그인 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.",
      });
      return;
    }
    const { error } = result;
    setSubmitting(false);
    if (error) {
      setFailedAttempts((prev) => prev + 1);
      const code = error.code ?? "";
      // §4: 휴면/탈퇴/미인증/제한 등 상태성 오류는 카드 상단 인라인 안내로.
      const statusMatch = STATUS_NOTICE_BY_CODE[code];
      if (statusMatch) {
        setStatusNotice(statusMatch);
        return;
      }
      // §3: 잘못된 자격 증명은 필드 하단 인라인 오류로.
      if (!code || FIELD_LEVEL_CODES.has(code)) {
        form.setFields([
          {
            name: "password",
            errors: ["이메일 또는 비밀번호가 올바르지 않아요."],
          },
        ]);
        return;
      }
      // 그 외(서버측 알 수 없는 오류)는 상단 인라인 안내.
      setStatusNotice({
        tone: "error",
        text: REASON_CONTENT[mapSupabaseErrorCode(code)].message,
      });
      return;
    }
    setFailedAttempts(0);
    router.push("/dashboard");
  }

  async function handleMagicLink(values: MagicLinkFields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(
          "/auth/callback?next=/dashboard",
        ),
      },
    });
    setSubmitting(false);
    if (error) {
      message.error(`매직링크 전송 실패: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`);
      return;
    }
    setMagicLinkSent(values.email);
  }

  if (magicLinkSent) {
    return (
      <div>
        <Title level={3}>이메일을 확인하세요</Title>
        <Paragraph>
          <strong>{magicLinkSent}</strong> 로 로그인 링크를 보냈습니다. 메일
          안의 링크를 누르면 대시보드로 이동합니다.
        </Paragraph>
        <Button onClick={() => setMagicLinkSent(null)}>다시 로그인 시도</Button>
      </div>
    );
  }

  return (
    <div>
      {activeNotice && (
        <Alert
          type={activeNotice.tone}
          showIcon
          message={activeNotice.text}
          style={{ marginBottom: 16 }}
          data-testid="login-session-notice"
        />
      )}
      {failedAttempts >= FAILED_ATTEMPTS_HINT_THRESHOLD && (
        <Alert
          type="info"
          showIcon
          message="여러 번 시도하셨어요. 잠시 후 다시 시도해주세요. 서버에서 짧은 시간 동안 추가 시도를 막을 수 있어요."
          style={{ marginBottom: 16 }}
          data-testid="login-failed-hint"
        />
      )}
      <Segmented
        block
        value={mode}
        onChange={(v) => {
          setMode(v as LoginMode);
          form.resetFields();
          setFailedAttempts(0);
          setStatusNotice(null);
        }}
        options={[
          { label: "비밀번호 로그인", value: "password" },
          { label: "매직링크 로그인", value: "magic-link" },
        ]}
        style={{ marginBottom: 16 }}
      />

      {mode === "password" ? (
        <Form
          form={form as FormInstance<PasswordFields>}
          layout="vertical"
          onFinish={handlePasswordLogin}
          requiredMark={false}
        >
          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: "이메일을 입력하세요" },
              { type: "email", message: "올바른 이메일 형식이 아닙니다" },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            label="비밀번호"
            name="password"
            rules={[{ required: true, message: "비밀번호를 입력하세요" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              로그인
            </Button>
          </Form.Item>
          <Paragraph style={{ textAlign: "center" }}>
            <Link href="/password-reset">비밀번호를 잊으셨나요?</Link>
          </Paragraph>
        </Form>
      ) : (
        <Form
          form={form as FormInstance<MagicLinkFields>}
          layout="vertical"
          onFinish={handleMagicLink}
          requiredMark={false}
        >
          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: "이메일을 입력하세요" },
              { type: "email", message: "올바른 이메일 형식이 아닙니다" },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              로그인 링크 받기
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
}
