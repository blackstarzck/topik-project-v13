"use client";

import {
  Alert,
  App,
  Button,
  Divider,
  Form,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Mail, MessageCircle, MonitorCheck } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppCard } from "@/components/shared/AppCard";

import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "@/lib/settings/types";
import { useUpdateNotificationPrefs } from "@/lib/settings/mutations";
import {
  fetchNotificationSettings,
  upsertNotificationSettings,
  NOTIFICATION_SETTINGS_DEFAULTS,
  type NotificationChannels,
  type NotificationSettings,
} from "./learning-settings-data";

const { Text } = Typography;

// i18n: 모듈 상수는 useTranslations를 쓸 수 없다(wave-2/3 key-expose 선례).
// 라벨은 카탈로그 키 이름만 보관하고, 실제 문구는 컴포넌트가
// t(`pref.${key}`) / t(`weekday.${key}`) / t(`logStatus.${key}`)로 해석한다.
const PREF_LABEL_KEYS: Record<NotificationPrefKey, string> = {
  weekly_summary: "weeklySummary",
  feedback_ready: "feedbackReady",
  study_reminder: "studyReminder",
};

const PREF_DESCRIPTION_KEYS: Record<NotificationPrefKey, string> = {
  weekly_summary: "weeklySummary",
  feedback_ready: "feedbackReady",
  study_reminder: "studyReminder",
};

// 요일 토글 — value는 JS Date 요일 인덱스(0=일), labelKey는 카탈로그 키.
const WEEKDAYS: { value: number; labelKey: string }[] = [
  { value: 1, labelKey: "mon" },
  { value: 2, labelKey: "tue" },
  { value: 3, labelKey: "wed" },
  { value: 4, labelKey: "thu" },
  { value: 5, labelKey: "fri" },
  { value: 6, labelKey: "sat" },
  { value: 0, labelKey: "sun" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Seoul", label: "Asia/Seoul" },
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh" },
  { value: "UTC", label: "UTC" },
];

const DAILY_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];

type SettingRowProps = {
  children: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  testId: string;
};

function SettingRow({ children, label, description, testId }: SettingRowProps) {
  return (
    <div className="notification-settings-row" data-testid={testId}>
      <div className="notification-settings-row-label">
        <span>{label}</span>
      </div>
      <div className="notification-settings-row-control">
        {children}
        {description ? (
          <Text type="secondary" className="notification-settings-row-hint">
            {description}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  /**
   * See `LanguageForm` for the rationale on accepting `userId` as a prop —
   * `useUpdateNotificationPrefs` is per-user and the data layer is read-only.
   */
  userId: string;
  initialPrefs: Partial<Record<NotificationPrefKey, boolean>>;
};

type SettingsLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

/**
 * Compute the diff between current form values and the initial server
 * snapshot. Missing keys in `initialPrefs` are treated as `false`. Only keys
 * whose value differs are included in the patch.
 */
export function computeNotificationDiff(
  current: NotificationPrefs,
  initial: NotificationPrefs,
): NotificationPrefs {
  const diff: NotificationPrefs = {};
  for (const key of NOTIFICATION_PREF_KEYS) {
    const next = current[key] ?? false;
    const prev = initial[key] ?? false;
    if (next !== prev) {
      diff[key] = next;
    }
  }
  return diff;
}

function settingsEqual(
  a: NotificationSettings,
  b: NotificationSettings,
): boolean {
  return (
    (a.reminder_time ?? "") === (b.reminder_time ?? "") &&
    a.timezone === b.timezone &&
    a.channels.in_app === b.channels.in_app &&
    a.channels.email === b.channels.email &&
    a.channels.zalo === b.channels.zalo &&
    a.reminder_days.length === b.reminder_days.length &&
    a.reminder_days.every((d) => b.reminder_days.includes(d))
  );
}

function timeStringToDayjs(value: string | null): Dayjs | null {
  if (!value) return null;
  // DB `time` returns "HH:mm:ss". Parse manually so we don't depend on the
  // dayjs customParseFormat plugin (not globally registered in this project).
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0);
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

function normalizePrefs(raw: NotificationPrefs): NotificationPrefs {
  const next: NotificationPrefs = {};
  for (const key of NOTIFICATION_PREF_KEYS) {
    next[key] = raw[key] ?? false;
  }
  return next;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * X-09 알림 설정 — notification_settings + profiles.notification_prefs.
 *
 * - Region 2 (알림 채널): in_app is a card toggle (aria-pressed); email/Zalo are
 *   disabled "준비 중" cards (external transport deferred). Selection persists to
 *   notification_settings.channels.
 * - Region 3 (학습 루틴): reminder_time (HH:mm) + reminder_days persisted;
 *   off-channel inputs are disabled when no channel is on.
 * - Region 5 (저장): dirty-gated, double-click guarded.
 * - The 3 boolean conditions still persist to profiles.notification_prefs.
 */
export function NotificationPrefsForm({ userId, initialPrefs }: Props) {
  const t = useTranslations("settings.notifications");
  const tCommon = useTranslations("common");
  const { message } = App.useApp();
  const prefsMutation = useUpdateNotificationPrefs(userId);

  const [values, setValues] = useState<NotificationPrefs>(() => {
    return normalizePrefs(initialPrefs);
  });
  const [savedPrefs, setSavedPrefs] = useState<NotificationPrefs>(() =>
    normalizePrefs(initialPrefs),
  );

  const [settingsLoad, setSettingsLoad] = useState<SettingsLoad>({
    status: "loading",
  });
  const [savedSettings, setSavedSettings] = useState<NotificationSettings>(
    NOTIFICATION_SETTINGS_DEFAULTS,
  );
  const [settings, setSettings] = useState<NotificationSettings>(
    NOTIFICATION_SETTINGS_DEFAULTS,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSettingsLoad({ status: "loading" });
      try {
        const value = await fetchNotificationSettings(userId);
        if (cancelled) return;
        setSavedSettings(value);
        setSettings(value);
        setSettingsLoad({ status: "ready" });
      } catch (err) {
        if (cancelled) return;
        setSettingsLoad({
          status: "error",
          message: errorMessage(err, t("loadError")),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const prefsDirty = NOTIFICATION_PREF_KEYS.some(
    (key) => (values[key] ?? false) !== (savedPrefs[key] ?? false),
  );
  const settingsDirty = !settingsEqual(settings, savedSettings);
  const isDirty = prefsDirty || settingsDirty;

  const anyChannelSelected =
    settings.channels.in_app ||
    settings.channels.email ||
    settings.channels.zalo;
  const onlyExternalChannelsSelected =
    !settings.channels.in_app &&
    (settings.channels.email || settings.channels.zalo);
  const reminderTime = useMemo(
    () => timeStringToDayjs(settings.reminder_time),
    [settings.reminder_time],
  );
  const reminderFrequency = useMemo(() => {
    if (sameDays(settings.reminder_days, DAILY_DAYS)) return "daily";
    if (sameDays(settings.reminder_days, WEEKDAY_DAYS)) return "weekdays";
    return "custom";
  }, [settings.reminder_days]);

  function setKey(key: NotificationPrefKey, value: boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setChannel(channel: keyof NotificationChannels, on: boolean) {
    setSettings((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: on },
    }));
  }

  function toggleDay(day: number) {
    setSettings((prev) => {
      const has = prev.reminder_days.includes(day);
      return {
        ...prev,
        reminder_days: has
          ? prev.reminder_days.filter((d) => d !== day)
          : [...prev.reminder_days, day].sort((a, b) => a - b),
      };
    });
  }

  function setReminderFrequency(value: string | number) {
    if (value === "daily") {
      setSettings((prev) => ({ ...prev, reminder_days: DAILY_DAYS }));
      return;
    }
    if (value === "weekdays") {
      setSettings((prev) => ({ ...prev, reminder_days: WEEKDAY_DAYS }));
      return;
    }
    if (value === "custom") {
      setSettings((prev) => ({ ...prev, reminder_days: [] }));
    }
  }

  // Region 1 예외 / region 5 제약: warn before leaving with unsaved changes.
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
    try {
      // Always persist the boolean conditions (the merge tolerates an empty
      // diff) so the form's submit contract stays simple and predictable.
      await prefsMutation.mutateAsync(
        computeNotificationDiff(values, savedPrefs),
      );
      setSavedPrefs(values);
      if (settingsDirty) {
        await upsertNotificationSettings(userId, settings);
        setSavedSettings(settings);
      }
      message.success(t("saveSuccess"));
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form
      data-testid="notification-settings-form"
      layout="vertical"
      onFinish={handleFinish}
      disabled={saving}
    >
      <div
        className="notification-settings-redesign"
        data-testid="notification-redesign-shell"
      >
        {settingsLoad.status === "error" ? (
          <Alert
            type="error"
            showIcon
            title={t("loadErrorTitle")}
            description={settingsLoad.message}
          />
        ) : null}

        {settingsLoad.status === "ready" && onlyExternalChannelsSelected ? (
          <Alert
            type="warning"
            showIcon
            title={t("externalOnly.title")}
            description={t("externalOnly.body")}
          />
        ) : null}

        {/* Region 2: 알림 채널 (인앱 / 이메일 / Zalo) */}
        <AppCard
          className="notification-settings-card"
          size="small"
          title={
            <h2 className="notification-settings-section-heading">
              {t("channel.cardTitle")}
            </h2>
          }
          data-testid="notification-channel-card"
        >
          {settingsLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <div className="notification-settings-card-body">
              <Text
                type="secondary"
                className="notification-settings-section-description"
              >
                {t("channel.cardDescription")}
              </Text>
              <div className="notification-settings-channel-grid">
                <button
                  type="button"
                  className="notification-settings-channel-option"
                  data-testid="notification-channel-in_app"
                  aria-pressed={settings.channels.in_app}
                  onClick={() =>
                    setChannel("in_app", !settings.channels.in_app)
                  }
                >
                  <span className="notification-settings-channel-copy">
                    <MonitorCheck
                      aria-hidden="true"
                      size={20}
                      strokeWidth={1.75}
                    />
                    <span>
                      <Text strong>{t("channel.inApp")}</Text>
                      <Text type="secondary">{t("channel.inAppHint")}</Text>
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="notification-settings-channel-option"
                  data-testid="notification-channel-email"
                  disabled
                  aria-disabled="true"
                >
                  <span className="notification-settings-channel-copy">
                    <Mail aria-hidden="true" size={20} strokeWidth={1.75} />
                    <span>
                      <Text strong>{t("channel.emailTab")}</Text>
                      <Text type="secondary">{t("channel.emailHint")}</Text>
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="notification-settings-channel-option"
                  data-testid="notification-channel-zalo"
                  disabled
                  aria-disabled="true"
                >
                  <span className="notification-settings-channel-copy">
                    <MessageCircle
                      aria-hidden="true"
                      size={20}
                      strokeWidth={1.75}
                    />
                    <span>
                      <span className="notification-settings-channel-title">
                        <Text strong>Zalo</Text>
                        <Tag>{t("channel.notConnected")}</Tag>
                      </span>
                      <Text type="secondary">{t("channel.zaloHint")}</Text>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </AppCard>

        <Divider className="notification-settings-divider" />

        {/* Region 3: 학습 루틴 */}
        <AppCard
          className="notification-settings-card"
          size="small"
          title={
            <h2 className="notification-settings-section-heading">
              {t("routine.cardTitle")}
            </h2>
          }
          data-testid="notification-routine-card"
        >
          <div className="notification-settings-card-body">
            <Text
              type="secondary"
              className="notification-settings-section-description"
            >
              {t("routine.cardDescription")}
            </Text>
            {settingsLoad.status === "loading" ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <SettingRow
                  label={t("routine.frequencyLabel")}
                  testId="notification-routine-row-frequency"
                  description={t("routine.frequencyHint")}
                >
                  <Segmented
                    value={reminderFrequency}
                    disabled={!anyChannelSelected}
                    onChange={setReminderFrequency}
                    options={[
                      { label: t("routine.frequencyDaily"), value: "daily" },
                      {
                        label: t("routine.frequencyWeekdays"),
                        value: "weekdays",
                      },
                      { label: t("routine.frequencyCustom"), value: "custom" },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  label={t("condition.reminderTimeLabel")}
                  testId="notification-routine-row-time"
                  description={
                    anyChannelSelected
                      ? undefined
                      : t("condition.reminderTimeExtra")
                  }
                >
                  <TimePicker
                    value={reminderTime}
                    disabled={!anyChannelSelected}
                    onChange={(value) =>
                      setSettings((prev) => ({
                        ...prev,
                        reminder_time: value ? value.format("HH:mm:ss") : null,
                      }))
                    }
                    format="HH:mm"
                    minuteStep={5}
                    placeholder="HH:mm"
                    aria-label={t("condition.reminderTimeAria")}
                  />
                </SettingRow>

                <SettingRow
                  label={t("condition.reminderDaysLabel")}
                  testId="notification-routine-row-days"
                  description={t("condition.reminderDaysHint")}
                >
                  <div className="notification-settings-inline-control">
                    {WEEKDAYS.map((d) => (
                      <Tag.CheckableTag
                        key={d.value}
                        checked={settings.reminder_days.includes(d.value)}
                        onChange={() =>
                          anyChannelSelected && toggleDay(d.value)
                        }
                        className={
                          anyChannelSelected
                            ? undefined
                            : "cursor-not-allowed opacity-50"
                        }
                      >
                        {t(`weekday.${d.labelKey}` as Parameters<typeof t>[0])}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow
                  label={t("condition.timezoneLabel")}
                  testId="notification-routine-row-timezone"
                  description={t("condition.timezoneHint")}
                >
                  <Select
                    className="notification-settings-timezone-select"
                    value={settings.timezone}
                    aria-label={t("condition.timezoneAria")}
                    options={TIMEZONE_OPTIONS}
                    onChange={(timezone) =>
                      setSettings((prev) => ({ ...prev, timezone }))
                    }
                  />
                </SettingRow>
              </>
            )}
          </div>
        </AppCard>

        <Divider className="notification-settings-divider" />

        {/* Region 3: 알림 내용 조건 */}
        <AppCard
          className="notification-settings-card"
          size="small"
          title={
            <h2 className="notification-settings-section-heading">
              {t("notificationTypes.cardTitle")}
            </h2>
          }
          data-testid="notification-condition-card"
        >
          <div className="notification-settings-card-body">
            <Text
              type="secondary"
              className="notification-settings-section-description"
            >
              {t("notificationTypes.cardDescription")}
            </Text>
            {/* Boolean conditions persist to profiles.notification_prefs and do
                not depend on the async notification_settings load. */}
            {NOTIFICATION_PREF_KEYS.map((key) => {
              const descriptionKey = PREF_DESCRIPTION_KEYS[key];
              const prefLabel = t(
                `pref.${PREF_LABEL_KEYS[key]}` as Parameters<typeof t>[0],
              );
              return (
                <div
                  key={key}
                  className="notification-settings-type-row"
                  data-testid={`notification-type-${key}`}
                >
                  <div className="notification-settings-type-copy">
                    <div>
                      <Text className="notification-settings-type-title">
                        {prefLabel}
                      </Text>
                      <Text
                        type="secondary"
                        className="notification-settings-type-description"
                      >
                        {t(
                          `prefDescription.${descriptionKey}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </Text>
                    </div>
                  </div>
                  <Switch
                    checked={values[key] ?? false}
                    onChange={(checked) => setKey(key, checked)}
                    aria-label={prefLabel}
                  />
                </div>
              );
            })}
          </div>
        </AppCard>

        {/* Region 5: 저장 CTA (변경값 없으면 비활성, 저장 중 중복 클릭 차단) */}
        <Form.Item className="!mb-0">
          <div className="flex justify-end">
            <Button
              data-testid="notification-save"
              type="primary"
              size="large"
              htmlType="submit"
              loading={saving}
              disabled={!isDirty || saving || settingsLoad.status !== "ready"}
            >
              {tCommon("save")}
            </Button>
          </div>
        </Form.Item>
      </div>
    </Form>
  );
}
