"use client";

import { App, Button, Form, Radio, Space, Typography } from "antd";
import { useState } from "react";

import { useUpdateLocale } from "@/lib/settings/mutations";

const { Paragraph, Text } = Typography;

type Locale = "ko" | "en" | "vi";

type Props = {
  /**
   * Authenticated user id. The settings mutation hooks are scoped per-user
   * (RLS enforces `id = auth.uid()`), so the caller — typically the page
   * server component — passes the resolved user id down. Light spec props
   * mention only `initialLocale`; we add `userId` because `useUpdateLocale`
   * (`src/lib/settings/mutations.ts`) requires it and we are not allowed to
   * modify the domain layer.
   */
  userId: string;
  initialLocale: Locale;
};

/**
 * `/settings/language` form (G-01). Single radio group for the three
 * supported UI locales. The label list is hard-coded — i18n message
 * catalogs are OOS-7 (Phase 6 light spec); Phase 6 only persists the
 * preference. The selected locale takes effect on next render after the
 * profile-settings query revalidates (handled by the mutation hook's
 * `onSuccess` invalidation).
 */
export function LanguageForm({ userId, initialLocale }: Props) {
  const { message } = App.useApp();
  const mutation = useUpdateLocale(userId);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  async function handleFinish() {
    try {
      await mutation.mutateAsync({ locale });
      message.success("언어가 변경되었습니다.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "언어 변경에 실패했어요.",
      );
    }
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Form.Item label="UI 언어" required>
        <Radio.Group
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label="UI 언어"
        >
          <Space direction="vertical">
            <Radio value="ko">한국어</Radio>
            <Radio value="en">English</Radio>
            <Radio value="vi">Tiếng Việt</Radio>
          </Space>
        </Radio.Group>
      </Form.Item>

      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        <Text type="secondary">변경사항이 즉시 반영됩니다.</Text>
      </Paragraph>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={mutation.isPending}
        >
          저장
        </Button>
      </Form.Item>
    </Form>
  );
}
