"use client";

import { useState } from "react";
import { Alert, App, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { REASON_CONTENT, mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

type Fields = { password: string; passwordConfirm: string };

export function PasswordResetConfirmForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // description §6 예외: 저장 실패/만료 시 재시도 + 링크 재발송 CTA 제공.
  const [saveFailed, setSaveFailed] = useState(false);

  async function handleSubmit(values: Fields) {
    setSubmitting(true);
    setSaveFailed(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      // raw provider error_description은 노출하지 않고 매핑된 한국어만 사용.
      message.error(`비밀번호 변경 실패: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`);
      setSaveFailed(true);
      return;
    }
    message.success("비밀번호가 변경되었습니다. 다시 로그인하세요.");
    router.push("/login");
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark={false}
    >
      <Title level={3}>새 비밀번호 설정</Title>
      <Paragraph>
        새로 사용할 비밀번호를 입력하세요. 8-64자 사이로 설정해주세요.
      </Paragraph>
      {saveFailed && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          data-testid="password-reset-confirm-error"
          message="비밀번호를 변경하지 못했어요"
          description={
            <span>
              링크가 만료됐거나 세션이 끊겼을 수 있어요. 다시 시도하거나{" "}
              <Link href="/password-reset">재설정 링크를 다시 받아주세요</Link>.
            </span>
          }
        />
      )}
      <Form.Item
        label="새 비밀번호"
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
      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          비밀번호 변경
        </Button>
      </Form.Item>
    </Form>
  );
}
