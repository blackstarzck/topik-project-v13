"use client";

import { useState } from "react";
import { App, Button, Checkbox, Form, Input, Typography } from "antd";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

type SignUpFields = {
  email: string;
  password: string;
  passwordConfirm: string;
  displayName?: string;
  terms: boolean;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "resending"; email: string };

export function SignUpForm() {
  const { message } = App.useApp();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [form] = Form.useForm<SignUpFields>();

  async function handleSignUp(values: SignUpFields) {
    setStatus({ kind: "submitting" });
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: values.displayName ? { display_name: values.displayName } : undefined,
        emailRedirectTo: buildAuthRedirectUrl("/onboarding/learning-goal"),
      },
    });

    if (error) {
      setStatus({ kind: "idle" });
      message.error(`가입 실패: ${error.message}`);
      return;
    }
    setStatus({ kind: "sent", email: values.email });
  }

  async function handleResend() {
    if (status.kind !== "sent") return;
    const currentEmail = status.email;
    setStatus({ kind: "resending", email: currentEmail });
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: status.email,
      options: {
        emailRedirectTo: buildAuthRedirectUrl("/onboarding/learning-goal"),
      },
    });
    setStatus({ kind: "sent", email: status.email });
    if (error) {
      message.error(`재전송 실패: ${error.message}`);
    } else {
      message.success("이메일을 다시 보냈습니다.");
    }
  }

  if (status.kind === "sent" || status.kind === "resending") {
    return (
      <div>
        <Title level={3}>이메일을 확인하세요</Title>
        <Paragraph>
          <strong>{status.email}</strong> 로 확인 메일을 보냈습니다. 메일 안의
          링크를 누르면 학습 목표 설정 화면으로 이동합니다.
        </Paragraph>
        <Button
          type="default"
          onClick={handleResend}
          loading={status.kind === "resending"}
        >
          이메일 다시 보내기
        </Button>
      </div>
    );
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

      <Form.Item label="이름 (선택)" name="displayName">
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
        <Checkbox>이용약관과 개인정보처리방침에 동의합니다</Checkbox>
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={status.kind === "submitting"}
        >
          회원가입
        </Button>
      </Form.Item>
    </Form>
  );
}
