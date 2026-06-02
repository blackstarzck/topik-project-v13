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
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/i18n/locales";
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
 * supported UI locales.
 *
 * i18n (G-01 foundation): on save we persist `profiles.ui_locale` (existing
 * mutation) AND write the `NEXT_LOCALE` cookie, then `router.refresh()`. The
 * cookie is the resolver's fallback for the just-saved value before the next
 * auth round-trip re-reads the DB row, and `router.refresh()` re-runs the
 * server render so the active locale (and the migrated UI surfaces) switch
 * immediately. The remaining (not-yet-migrated) screen text still renders in
 * its source language until migrated — see `coverageNote` copy.
 */
export function LanguageForm({ userId, initialLocale }: Props) {
  const t = useTranslations("settings.language");
  const tCommon = useTranslations("common");
  const router = useRouter();
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
              : t("learningSettingsLoadError"),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

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

      if (!window.confirm(t("unsavedLeave"))) {
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
  }, [isDirty, t]);

  async function handleFinish() {
    setSaving(true);
    const localeChanged = uiLocaleDirty;
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
      message.success(t("saveSuccess"));

      // i18n (G-01): make the new UI locale take effect immediately. The
      // server resolver reads profiles.ui_locale first, but the just-written
      // value may not be visible on the very next render (auth/RLS round-trip),
      // so we also set the NEXT_LOCALE cookie as the authoritative fallback,
      // then refresh so the server re-renders with the new locale + catalog.
      if (localeChanged && typeof document !== "undefined") {
        document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
        router.refresh();
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form layout="vertical" onFinish={handleFinish} disabled={saving}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* Region 2: UI 언어 선택 */}
        <Form.Item label={t("uiLanguageLabel")} required style={{ marginBottom: 0 }}>
          <Radio.Group
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t("uiLanguageLabel")}
          >
            <Space direction="vertical">
              <Radio value="ko">{t("optionKo")}</Radio>
              <Radio value="en">{t("optionEn")}</Radio>
              <Radio value="vi">{t("optionVi")}</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text type="secondary">{t("coverageNote")}</Text>
        </Paragraph>

        {/* Region 3: 학습 언어 선택 (설명·예시·번역 보조 기준 언어) */}
        <Card size="small" title={t("learningCardTitle")}>
          {contentLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : contentLoad.status === "error" ? (
            <Alert
              type="error"
              showIcon
              message={t("learningLoadError")}
              description={contentLoad.message}
            />
          ) : (
            <Form.Item
              label={t("learningFieldLabel")}
              style={{ marginBottom: 0 }}
              extra={t("learningFieldExtra")}
            >
              <Radio.Group
                value={learningLocale ?? "follow"}
                onChange={(e) => {
                  const v = e.target.value as LearningLocale | "follow";
                  setLearningLocale(v === "follow" ? null : v);
                }}
                aria-label={t("learningCardTitle")}
              >
                <Space direction="vertical">
                  <Radio value="follow">{t("learningFollow")}</Radio>
                  <Radio value="ko">{t("optionKo")}</Radio>
                  <Radio value="en">{t("optionEn")}</Radio>
                  <Radio value="vi">{t("optionVi")}</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          )}
        </Card>

        {/* Region 4: 콘텐츠 설정 (피드백 표시 · 예문 난이도 · 해설 길이) */}
        <Card size="small" title={t("contentCardTitle")}>
          {contentLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : contentLoad.status === "error" ? (
            <Alert
              type="error"
              showIcon
              message={t("contentLoadError")}
              description={contentLoad.message}
            />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Form.Item label={t("feedbackDisplayLabel")} style={{ marginBottom: 0 }}>
                <Segmented
                  value={
                    contentPrefs.feedback_display ??
                    CONTENT_PREF_DEFAULTS.feedback_display
                  }
                  onChange={(v) =>
                    setPref("feedback_display", v as "full" | "summary")
                  }
                  options={[
                    { label: t("feedbackFull"), value: "full" },
                    { label: t("feedbackSummary"), value: "summary" },
                  ]}
                />
              </Form.Item>
              <Form.Item label={t("exampleDifficultyLabel")} style={{ marginBottom: 0 }}>
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
                    { label: t("difficultyEasy"), value: "easy" },
                    { label: t("difficultyStandard"), value: "standard" },
                    { label: t("difficultyHard"), value: "hard" },
                  ]}
                />
              </Form.Item>
              <Form.Item label={t("explanationLengthLabel")} style={{ marginBottom: 0 }}>
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
                    { label: t("explanationShort"), value: "short" },
                    { label: t("explanationStandard"), value: "standard" },
                    { label: t("explanationDetailed"), value: "detailed" },
                  ]}
                />
              </Form.Item>

              {/* Region 4 예외: 옵션 충돌 시 경고 + 추천값 복원 */}
              {conflict ? (
                <Alert
                  type="warning"
                  showIcon
                  message={t("conflictTitle")}
                  description={t("conflictDescription")}
                  action={
                    <Button size="small" onClick={restoreRecommended}>
                      {t("restoreRecommended")}
                    </Button>
                  }
                />
              ) : null}
            </Space>
          )}
        </Card>

        {/* Region 5: 도움말 (언어 설정 영향 범위 안내) */}
        <Card size="small" title={t("helpCardTitle")}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <Text type="secondary">{t("helpUiScope")}</Text>
            </li>
            <li>
              <Text type="secondary">{t("helpLearningScope")}</Text>
            </li>
            <li>
              <Text type="secondary">{t("helpIncremental")}</Text>
            </li>
          </ul>
        </Card>

        {/* Region 2 예외: 미지원 언어 안내 */}
        <Alert type="info" showIcon message={t("unsupportedNotice")} />

        {/* Region 6: 저장 (변경값 없으면 비활성, 저장 중 중복 클릭 차단) */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!isDirty || saving}
          >
            {tCommon("save")}
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
