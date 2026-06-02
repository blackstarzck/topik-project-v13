"use client";

import { useState } from "react";
import { Alert, App, Button, Card, Form, Input, Space, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { REASON_CONTENT, mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title, Text } = Typography;

type Fields = { password: string; passwordConfirm: string };

// Supabase recovery 링크 기본 유효시간 ≈ 1시간. 정확한 발급 시각은 클라이언트에
// 없으므로(이메일에서 진입), 페이지 진입 시각 + 1h 를 "대략" 만료 시각으로 안내한다.
// 가짜 정밀도를 만들지 않도록 "약" 으로 명시 (description §4: 절대/상대 시간 병기).
const LINK_TTL_MINUTES = 60;

function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function PasswordResetConfirmForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // description §6 예외: 저장 실패/만료 시 재시도 + 링크 재발송 CTA 제공.
  const [saveFailed, setSaveFailed] = useState(false);
  // §3: 새 비밀번호 강도/규칙 실시간 검증을 위해 입력값 watch.
  const [passwordValue, setPasswordValue] = useState("");
  // §4: 만료 시간 절대/상대 병기. 진입 시각 기준으로 클라이언트에서 1회 계산.
  // SSR에서는 null (Date.now() 하이드레이션 mismatch 회피), 마운트 시점 lazy init.
  const [expiresAt] = useState<Date | null>(() =>
    typeof window === "undefined"
      ? null
      : new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000),
  );

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
      message.error(
        `비밀번호 변경 실패: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`,
      );
      setSaveFailed(true);
      return;
    }
    message.success("비밀번호가 변경되었습니다. 다시 로그인하세요.");
    router.push("/login");
  }

  return (
    // §1 재설정 카드 — 절차 전체를 담는 중앙 컨테이너 (폭 360-520px).
    <Card style={{ maxWidth: 520, margin: "0 auto" }}>
      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        {/* §5 마스코트 — 보안 절차 긴장감 완화, 입력 영역을 가리지 않게 상단 배치 */}
        <AuthMascot
          alt="TALKPIK 보안 도우미 캐릭터"
          emoji="🔐"
          size={48}
        />
        {/* §2 흐름 안내 — Stepper 미사용, 헤더 카피가 곧 위치 안내 */}
        <Title level={3} style={{ textAlign: "center", marginTop: 12 }}>
          새 비밀번호 설정
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center" }}>
          이메일 링크로 들어오셨어요. 마지막 단계예요 — 새 비밀번호만 정하면
          끝나요.
        </Paragraph>

        {/* §4 안내 카피 — 보안 조건 + 만료 시간(절대/상대 병기) */}
        <Paragraph style={{ marginBottom: 16 }}>
          <Text type="secondary">
            8-64자, 영문·숫자·특수문자를 섞으면 더 안전해요.
            {expiresAt ? (
              <>
                {" "}
                이 링크는 약 {LINK_TTL_MINUTES}분 후(
                {formatAbsolute(expiresAt)}쯤) 만료돼요.
              </>
            ) : null}
          </Text>
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
                <Link href="/password-reset">
                  재설정 링크를 다시 받아주세요
                </Link>
                .
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
          <Input.Password
            autoComplete="new-password"
            onChange={(event) => setPasswordValue(event.target.value)}
          />
        </Form.Item>

        {/* §3: 비밀번호 규칙 실시간 검증 (강도 + 체크리스트) */}
        <PasswordStrengthMeter password={passwordValue} />

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
                return Promise.reject(
                  new Error("비밀번호가 일치하지 않습니다"),
                );
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              비밀번호 변경
            </Button>
            {/* §6: 로그인 화면 복귀 escape */}
            <Link href="/login">
              <Button type="link" block>
                로그인 화면으로 돌아가기
              </Button>
            </Link>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
