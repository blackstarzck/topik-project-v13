"use client";

import { Alert, App, Button, Card, Form, Radio, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

import { useUpdateLocale } from "@/lib/settings/mutations";

const { Paragraph, Text } = Typography;

const UNSAVED_LANGUAGE_LEAVE_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠어요?";

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
  const [savedLocale, setSavedLocale] = useState<Locale>(initialLocale);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const isDirty = locale !== savedLocale;

  // G-01 region 1 예외 / region 6 제약: warn before leaving with unsaved
  // changes. beforeunload covers tab close/reload; a capturing same-origin
  // anchor intercept covers in-app navigation via links. (router.push from
  // non-anchor controls is not intercepted — noted as a known limitation.)
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      if (!window.confirm(UNSAVED_LANGUAGE_LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  async function handleFinish() {
    try {
      await mutation.mutateAsync({ locale });
      setSavedLocale(locale);
      message.success("언어 설정이 저장되었습니다.");
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
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* Region 2: UI 언어 선택 */}
        <Form.Item label="UI 언어" required style={{ marginBottom: 0 }}>
          <Radio.Group
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label="UI 언어"
          >
            <Space direction="vertical">
              <Radio value="ko">한국어 (Korean)</Radio>
              <Radio value="en">English (English)</Radio>
              <Radio value="vi">Tiếng Việt (Vietnamese)</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text type="secondary">
            선택한 UI 언어는 저장하면 환경설정에 반영됩니다. 화면 문구 전체
            번역(다국어 메시지)은 준비 중이라 일부 화면은 아직 한국어로
            표시될 수 있어요.
          </Text>
        </Paragraph>

        {/* Region 3: 학습 언어 선택 (번역 보조 기준 언어) — 준비 중 */}
        <Card size="small" title="학습 언어">
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Space>
              <Text>설명·예시·번역 보조 기준 언어</Text>
              <Tag>준비 중</Tag>
            </Space>
            <Text type="secondary">
              학습 보조 콘텐츠의 기준 언어 선택은 다음 업데이트에서 제공됩니다.
              현재는 기본 언어로 표시됩니다.
            </Text>
          </Space>
        </Card>

        {/* Region 4: 콘텐츠 설정 (피드백 표시·해설 길이 등) — 준비 중 */}
        <Card size="small" title="콘텐츠 설정">
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Space>
              <Text>피드백 표시 · 예문 난이도 · 해설 길이</Text>
              <Tag>준비 중</Tag>
            </Space>
            <Text type="secondary">
              학습 콘텐츠 표시 옵션은 다음 업데이트에서 조정할 수 있어요.
            </Text>
          </Space>
        </Card>

        {/* Region 5: 도움말 (언어 설정 영향 범위 안내) */}
        <Card size="small" title="도움말">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <Text type="secondary">
                UI 언어는 메뉴·버튼 등 인터페이스 문구에 적용됩니다.
              </Text>
            </li>
            <li>
              <Text type="secondary">
                학습 언어·콘텐츠 설정은 준비 중이며 저장되지 않습니다.
              </Text>
            </li>
          </ul>
        </Card>

        {/* Region 2 예외: 미지원 언어 안내 */}
        <Alert
          type="info"
          showIcon
          message="현재 한국어·English·Tiếng Việt를 지원합니다. 그 외 언어는 지원 예정입니다."
        />

        {/* Region 6: 저장 (변경값 없으면 비활성) */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={!isDirty || mutation.isPending}
          >
            저장
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
