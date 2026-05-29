"use client";

// Phase 7-B (original) + Phase 8-D (verify-email redirect)
// - After successful sign-up, router.push('/auth/verify-email?email=...')
//   instead of in-place "이메일 확인하세요" state. Verify page handles
//   resend with 60s cooldown and survives reloads/deep-links.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Checkbox, Form, Input, Typography } from "antd";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { REASON_CONTENT, mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

type SignUpFields = {
  email: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
  terms: boolean;
};

export function SignUpForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SignUpFields>();

  async function handleSignUp(values: SignUpFields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: buildAuthRedirectUrl(
          "/auth/callback?next=/onboarding/learning-goal",
        ),
      },
    });

    if (error) {
      setSubmitting(false);
      message.error(`가입 실패: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`);
      return;
    }
    router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSignUp}
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
        rules={[
          { required: true, message: "비밀번호를 입력하세요" },
          { min: 8, message: "비밀번호는 8자 이상이어야 합니다" },
          { max: 64, message: "비밀번호는 64자 이하여야 합니다" },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="비밀번호 확인"
        name="passwordConfirm"
        dependencies={["password"]}
        rules={[
          { required: true, message: "비밀번호를 다시 입력하세요" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("비밀번호가 일치하지 않습니다"));
            },
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="이름"
        name="displayName"
        rules={[
          { required: true, message: "이름을 입력하세요" },
          { min: 2, message: "이름은 2자 이상이어야 합니다" },
          { max: 30, message: "이름은 30자 이하여야 합니다" },
        ]}
      >
        <Input autoComplete="name" placeholder="홍길동" />
      </Form.Item>

      <Form.Item
        name="terms"
        valuePropName="checked"
        rules={[
          {
            validator: (_, value) =>
              value
                ? Promise.resolve()
                : Promise.reject(new Error("이용약관에 동의해주세요")),
          },
        ]}
      >
        <Checkbox>
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            이용약관
          </Link>
          과{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            개인정보처리방침
          </Link>
          에 동의합니다
        </Checkbox>
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
        >
          회원가입
        </Button>
      </Form.Item>
    </Form>
  );
}
