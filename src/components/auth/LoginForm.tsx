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

const SESSION_NOTICE: Record<string, string> = {
  session_expired: "세션이 만료되어 로그아웃됐어요. 다시 로그인해주세요.",
};

type LoginMode = "password" | "magic-link";

type PasswordFields = { email: string; password: string };
type MagicLinkFields = { email: string };

export function LoginForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeReason = searchParams.get("reason");
  const noticeText = noticeReason ? SESSION_NOTICE[noticeReason] : undefined;
  const [mode, setMode] = useState<LoginMode>("password");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState<string | null>(null);
  const [form] = Form.useForm<PasswordFields | MagicLinkFields>();

  async function handlePasswordLogin(values: PasswordFields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      message.error(`로그인 실패: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`);
      return;
    }
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
      {noticeText && (
        <Alert
          type="warning"
          showIcon
          message={noticeText}
          style={{ marginBottom: 16 }}
          data-testid="login-session-notice"
        />
      )}
      <Segmented
        block
        value={mode}
        onChange={(v) => {
          setMode(v as LoginMode);
          form.resetFields();
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
