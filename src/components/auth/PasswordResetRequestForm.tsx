"use client";

import { useState } from "react";
import { App, Button, Form, Input, Typography } from "antd";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

type Fields = { email: string };

export function PasswordResetRequestForm() {
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(values: Fields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: buildAuthRedirectUrl("/password-reset/confirm"),
    });
    setSubmitting(false);
    if (error) {
      message.error(`전송 실패: ${error.message}`);
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div>
        <Title level={3}>이메일을 확인하세요</Title>
        <Paragraph>
          <strong>{sentTo}</strong> 로 비밀번호 재설정 링크를 보냈습니다. 메일
          안의 링크를 누르면 새 비밀번호 설정 화면으로 이동합니다.
        </Paragraph>
      </div>
    );
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark={false}
    >
      <Paragraph>
        가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
      </Paragraph>
      <Form.Item
        label="이메일"
        name="email"
        rules={[
          { required: true, message: "이메일을 입력하세요" },
          { type: "email", message: "올바른 이메일 형식이 아닙니다" },
        ]}
      >
        <Input autoComplete="email" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          재설정 링크 보내기
        </Button>
      </Form.Item>
    </Form>
  );
}
