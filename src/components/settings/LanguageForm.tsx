"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Radio,
  Segmented,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

import { useUpdateLocale } from "@/lib/settings/mutations";
import {
  CONTENT_PREF_DEFAULTS,
  detectContentPrefConflict,
  fetchLearningSettings,
  updateLearningSettings,
  type ContentPrefs,
  type LearningLocale,
} from "./learning-settings-data";

const { Paragraph, Text } = Typography;

type ContentLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function contentPrefsEqual(a: ContentPrefs, b: ContentPrefs): boolean {
  return (
    (a.feedback_display ?? CONTENT_PREF_DEFAULTS.feedback_display) ===
      (b.feedback_display ?? CONTENT_PREF_DEFAULTS.feedback_display) &&
    (a.example_difficulty ?? CONTENT_PREF_DEFAULTS.example_difficulty) ===
      (b.example_difficulty ?? CONTENT_PREF_DEFAULTS.example_difficulty) &&
    (a.explanation_length ?? CONTENT_PREF_DEFAULTS.explanation_length) ===
      (b.explanation_length ?? CONTENT_PREF_DEFAULTS.explanation_length)
  );
}

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

  // Region 3 (학습 언어) + Region 4 (콘텐츠 설정) — persisted to
  // profiles.learning_locale / profiles.content_prefs.
  const [contentLoad, setContentLoad] = useState<ContentLoad>({
    status: "loading",
  });
  const [savedLearningLocale, setSavedLearningLocale] =
    useState<LearningLocale | null>(null);
  const [learningLocale, setLearningLocale] = useState<LearningLocale | null>(
    null,
  );
  const [savedContentPrefs, setSavedContentPrefs] = useState<ContentPrefs>({});
  const [contentPrefs, setContentPrefs] = useState<ContentPrefs>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchLearningSettings(userId);
        if (cancelled) return;
        setSavedLearningLocale(settings.learning_locale);
        setLearningLocale(settings.learning_locale);
        setSavedContentPrefs(settings.content_prefs);
        setContentPrefs(settings.content_prefs);
        setContentLoad({ status: "ready" });
      } catch (err) {
        if (cancelled) return;
        setContentLoad({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "콘텐츠 설정을 불러오지 못했어요.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const conflict = detectContentPrefConflict(contentPrefs);

  const learningLocaleDirty = learningLocale !== savedLearningLocale;
  const contentPrefsDirty = !contentPrefsEqual(contentPrefs, savedContentPrefs);
  const uiLocaleDirty = locale !== savedLocale;
  const isDirty = uiLocaleDirty || learningLocaleDirty || contentPrefsDirty;

  function setPref<K extends keyof ContentPrefs>(
    key: K,
    value: NonNullable<ContentPrefs[K]>,
  ) {
    setContentPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function restoreRecommended() {
    setContentPrefs({ ...CONTENT_PREF_DEFAULTS });
  }

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
    setSaving(true);
    try {
      // Always persist the UI locale on submit (idempotent) so the submit
      // contract stays simple and predictable.
      await mutation.mutateAsync({ locale });
      setSavedLocale(locale);
      if (learningLocaleDirty || contentPrefsDirty) {
        await updateLearningSettings(userId, {
          ...(learningLocaleDirty ? { learning_locale: learningLocale } : {}),
          ...(contentPrefsDirty ? { content_prefs: contentPrefs } : {}),
        });
        setSavedLearningLocale(learningLocale);
        setSavedContentPrefs(contentPrefs);
      }
      message.success("언어·콘텐츠 설정이 저장되었습니다.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "설정 저장에 실패했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form layout="vertical" onFinish={handleFinish} disabled={saving}>
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

        {/* Region 3: 학습 언어 선택 (설명·예시·번역 보조 기준 언어) */}
        <Card size="small" title="학습 언어">
          {contentLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : contentLoad.status === "error" ? (
            <Alert
              type="error"
              showIcon
              message="학습 설정을 불러오지 못했어요"
              description={contentLoad.message}
            />
          ) : (
            <Form.Item
              label="설명·예시·번역 보조 기준 언어"
              style={{ marginBottom: 0 }}
              extra="미설정 시 UI 언어를 따릅니다. 일부 언어는 번역이 없어 기본 언어로 표시될 수 있어요."
            >
              <Radio.Group
                value={learningLocale ?? "follow"}
                onChange={(e) => {
                  const v = e.target.value as LearningLocale | "follow";
                  setLearningLocale(v === "follow" ? null : v);
                }}
                aria-label="학습 언어"
              >
                <Space direction="vertical">
                  <Radio value="follow">UI 언어 따르기</Radio>
                  <Radio value="ko">한국어 (Korean)</Radio>
                  <Radio value="en">English (English)</Radio>
                  <Radio value="vi">Tiếng Việt (Vietnamese)</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          )}
        </Card>

        {/* Region 4: 콘텐츠 설정 (피드백 표시 · 예문 난이도 · 해설 길이) */}
        <Card size="small" title="콘텐츠 설정">
          {contentLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : contentLoad.status === "error" ? (
            <Alert
              type="error"
              showIcon
              message="콘텐츠 설정을 불러오지 못했어요"
              description={contentLoad.message}
            />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Form.Item label="피드백 표시" style={{ marginBottom: 0 }}>
                <Segmented
                  value={
                    contentPrefs.feedback_display ??
                    CONTENT_PREF_DEFAULTS.feedback_display
                  }
                  onChange={(v) =>
                    setPref("feedback_display", v as "full" | "summary")
                  }
                  options={[
                    { label: "자세히", value: "full" },
                    { label: "요약", value: "summary" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="예문 난이도" style={{ marginBottom: 0 }}>
                <Segmented
                  value={
                    contentPrefs.example_difficulty ??
                    CONTENT_PREF_DEFAULTS.example_difficulty
                  }
                  onChange={(v) =>
                    setPref(
                      "example_difficulty",
                      v as "easy" | "standard" | "hard",
                    )
                  }
                  options={[
                    { label: "쉬움", value: "easy" },
                    { label: "보통", value: "standard" },
                    { label: "어려움", value: "hard" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="해설 길이" style={{ marginBottom: 0 }}>
                <Segmented
                  value={
                    contentPrefs.explanation_length ??
                    CONTENT_PREF_DEFAULTS.explanation_length
                  }
                  onChange={(v) =>
                    setPref(
                      "explanation_length",
                      v as "short" | "standard" | "detailed",
                    )
                  }
                  options={[
                    { label: "짧게", value: "short" },
                    { label: "보통", value: "standard" },
                    { label: "자세히", value: "detailed" },
                  ]}
                />
              </Form.Item>

              {/* Region 4 예외: 옵션 충돌 시 경고 + 추천값 복원 */}
              {conflict ? (
                <Alert
                  type="warning"
                  showIcon
                  message="설정이 서로 충돌해요"
                  description="요약 피드백과 자세한 해설은 함께 쓰기 어려운 조합이에요. 추천값으로 되돌릴 수 있어요."
                  action={
                    <Button size="small" onClick={restoreRecommended}>
                      추천값 복원
                    </Button>
                  }
                />
              ) : null}
            </Space>
          )}
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
                학습 언어·콘텐츠 설정은 첨삭·예문·해설 표시에 반영됩니다.
              </Text>
            </li>
            <li>
              <Text type="secondary">
                화면 문구 전체 번역(다국어 메시지)은 순차적으로 적용됩니다.
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

        {/* Region 6: 저장 (변경값 없으면 비활성, 저장 중 중복 클릭 차단) */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!isDirty || saving}
          >
            저장
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
