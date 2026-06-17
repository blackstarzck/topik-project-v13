"use client";

import {
  Alert,
  App,
  Button,
  Checkbox,
  Empty,
  Form,
  List,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";

import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "@/lib/settings/types";
import { useUpdateNotificationPrefs } from "@/lib/settings/mutations";
import {
  fetchDeliveryHistory,
  type DeliveryHistoryEntry,
} from "@/components/notifications/notifications-data";
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

// 발송 이력 status enum → 카탈로그 키(enum 값은 그대로 유지).
const LOG_STATUS_BADGE_META: Record<
  DeliveryHistoryEntry["status"],
  { labelKey: string }
> = {
  sent: { labelKey: "sent" },
  failed: { labelKey: "failed" },
  pending: { labelKey: "pending" },
  skipped: { labelKey: "skipped" },
  opted_out: { labelKey: "optedOut" },
  deduped: { labelKey: "deduped" },
};

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

function settingsEqual(a: NotificationSettings, b: NotificationSettings): boolean {
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

/**
 * X-09 알림 설정 — real notification_settings + notification_log.
 *
 * - Region 2 (채널 탭): 이메일 / Zalo / 둘 다, with channel-enable checkboxes
 *   persisted to notification_settings.channels. Zalo is shown as 미연동 (no
 *   external integration); enabling it is allowed for preference, but a notice
 *   makes clear delivery is 연동 예정.
 * - Region 3 (조건 입력): reminder_time (HH:mm) + reminder_days persisted;
 *   off-channel inputs are disabled when no channel is on.
 * - Region 4 (미리보기/도움말): preview copy + 발송 이력 5개 from
 *   notification_delivery_attempts (fetchDeliveryHistory).
 * - Region 5 (저장): dirty-gated, double-click guarded.
 * - 수신 권한 없음 notice when both channels off.
 * - The 3 boolean conditions still persist to profiles.notification_prefs.
 * - REAL SEND is an external stub (no transport) — preview/log only.
 */
export function NotificationPrefsForm({ userId, initialPrefs }: Props) {
  const t = useTranslations("settings.notifications");
  const tCommon = useTranslations("common");
  const { message } = App.useApp();
  const prefsMutation = useUpdateNotificationPrefs(userId);

  const [values, setValues] = useState<NotificationPrefs>(() => {
    const seed: NotificationPrefs = {};
    for (const key of NOTIFICATION_PREF_KEYS) {
      seed[key] = initialPrefs[key] ?? false;
    }
    return seed;
  });

  const [settingsLoad, setSettingsLoad] = useState<SettingsLoad>({
    status: "loading",
  });
  const [savedSettings, setSavedSettings] = useState<NotificationSettings>(
    NOTIFICATION_SETTINGS_DEFAULTS,
  );
  const [settings, setSettings] = useState<NotificationSettings>(
    NOTIFICATION_SETTINGS_DEFAULTS,
  );
  const [log, setLog] = useState<DeliveryHistoryEntry[]>([]);
  const [activeChannel, setActiveChannel] = useState<"email" | "zalo" | "both">(
    "email",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, l] = await Promise.all([
          fetchNotificationSettings(userId),
          fetchDeliveryHistory(userId, 5).catch(
            () => [] as DeliveryHistoryEntry[],
          ),
        ]);
        if (cancelled) return;
        setSavedSettings(s);
        setSettings(s);
        setLog(l);
        setSettingsLoad({ status: "ready" });
      } catch (err) {
        if (cancelled) return;
        setSettingsLoad({
          status: "error",
          message: err instanceof Error ? err.message : t("loadError"),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const prefsDirty = NOTIFICATION_PREF_KEYS.some(
    (key) => (values[key] ?? false) !== (initialPrefs[key] ?? false),
  );
  const settingsDirty = !settingsEqual(settings, savedSettings);
  const isDirty = prefsDirty || settingsDirty;

  const anyChannelOn = settings.channels.email || settings.channels.zalo;
  const reminderTime = useMemo(
    () => timeStringToDayjs(settings.reminder_time),
    [settings.reminder_time],
  );

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
        computeNotificationDiff(values, initialPrefs),
      );
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

  const reminderPreview = reminderTime
    ? t("previewScheduled", {
        time: reminderTime.format("HH:mm"),
        timezone: settings.timezone,
      })
    : t("previewEmpty");

  const channelTabs = [
    {
      key: "email",
      label: t("channel.emailTab"),
      children: (
        <div className="flex w-full flex-col gap-2">
          <Checkbox
            checked={settings.channels.email}
            onChange={(e) => setChannel("email", e.target.checked)}
          >
            {t("channel.emailReceive")}
          </Checkbox>
          <Text type="secondary">{t("channel.emailHint")}</Text>
        </div>
      ),
    },
    {
      key: "zalo",
      label: (
        <span className="inline-flex items-center gap-1">
          Zalo
          <Tag>{t("channel.notConnected")}</Tag>
        </span>
      ),
      children: (
        <div className="flex w-full flex-col gap-2">
          <Checkbox
            checked={settings.channels.zalo}
            onChange={(e) => setChannel("zalo", e.target.checked)}
          >
            {t("channel.zaloReceive")}
          </Checkbox>
          <Text type="secondary">{t("channel.zaloHint")}</Text>
        </div>
      ),
    },
    {
      key: "both",
      label: t("channel.bothTab"),
      children: (
        <div className="flex w-full flex-col gap-2">
          <Checkbox
            checked={settings.channels.email}
            onChange={(e) => setChannel("email", e.target.checked)}
          >
            {t("channel.emailReceive")}
          </Checkbox>
          <Checkbox
            checked={settings.channels.zalo}
            onChange={(e) => setChannel("zalo", e.target.checked)}
          >
            {t("channel.zaloReceivePending")}
          </Checkbox>
        </div>
      ),
    },
  ];

  return (
    <Form
      data-testid="notification-settings-form"
      layout="vertical"
      onFinish={handleFinish}
      disabled={saving}
    >
      <div className="flex w-full flex-col gap-4">
        {settingsLoad.status === "error" ? (
          <Alert
            type="error"
            showIcon
            title={t("loadErrorTitle")}
            description={settingsLoad.message}
          />
        ) : null}

        {/* 수신 권한 없음 notice (both channels off) */}
        {settingsLoad.status === "ready" && !anyChannelOn ? (
          <Alert
            type="warning"
            showIcon
            title={t("noChannel.title")}
            description={t("noChannel.body")}
          />
        ) : null}

        {/* Region 2: 알림 채널 탭 (이메일 / Zalo / 둘 다) */}
        <AppCard
          size="small"
          title={t("channel.cardTitle")}
          data-testid="notification-channel-card"
        >
          {settingsLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Tabs
              activeKey={activeChannel}
              onChange={(k) => setActiveChannel(k as "email" | "zalo" | "both")}
              items={channelTabs}
            />
          )}
        </AppCard>

        {/* Region 3: 알림 조건 입력 */}
        <AppCard
          size="small"
          title={t("condition.cardTitle")}
          data-testid="notification-condition-card"
        >
          <div className="flex w-full flex-col gap-4">
            {/* Boolean conditions persist to profiles.notification_prefs and do
                not depend on the async notification_settings load. */}
            {NOTIFICATION_PREF_KEYS.map((key) => {
              const prefLabel = t(
                `pref.${PREF_LABEL_KEYS[key]}` as Parameters<typeof t>[0],
              );
              return (
                <Form.Item
                  key={key}
                  label={prefLabel}
                  className="!mb-0"
                >
                  <Switch
                    checked={values[key] ?? false}
                    onChange={(checked) => setKey(key, checked)}
                    aria-label={prefLabel}
                  />
                  <Text type="secondary" className="ml-3">
                    {values[key] ? t("condition.on") : t("condition.off")}
                  </Text>
                </Form.Item>
              );
            })}

            {/* Schedule (time/days) needs the loaded notification_settings. */}
            {settingsLoad.status === "loading" ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Form.Item
                  label={t("condition.reminderTimeLabel")}
                  className="!mb-0"
                  extra={
                    anyChannelOn ? undefined : t("condition.reminderTimeExtra")
                  }
                >
                  <TimePicker
                    value={reminderTime}
                    disabled={!anyChannelOn}
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
                </Form.Item>

                <Form.Item
                  label={t("condition.timezoneLabel")}
                  className="!mb-0"
                >
                  <Select
                    className="max-w-xs"
                    value={settings.timezone}
                    aria-label={t("condition.timezoneAria")}
                    options={TIMEZONE_OPTIONS}
                    onChange={(timezone) =>
                      setSettings((prev) => ({ ...prev, timezone }))
                    }
                  />
                </Form.Item>

                <Form.Item
                  label={t("condition.reminderDaysLabel")}
                  className="!mb-0"
                >
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => (
                      <Tag.CheckableTag
                        key={d.value}
                        checked={settings.reminder_days.includes(d.value)}
                        onChange={() => anyChannelOn && toggleDay(d.value)}
                        className={
                          anyChannelOn ? undefined : "cursor-not-allowed opacity-50"
                        }
                      >
                        {t(`weekday.${d.labelKey}` as Parameters<typeof t>[0])}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                </Form.Item>
              </>
            )}
          </div>
        </AppCard>

        {/* Region 4: 미리보기 / 발송 이력 */}
        <AppCard
          size="small"
          title={t("preview.cardTitle")}
          data-testid="notification-preview-card"
        >
          <Text type="secondary">{reminderPreview}</Text>
        </AppCard>

        <AppCard
          size="small"
          title={t("history.cardTitle")}
          data-testid="notification-history-card"
        >
          {settingsLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : log.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("history.empty")}
            />
          ) : (
            <List
              size="small"
              dataSource={log}
              renderItem={(entry) => (
                <List.Item>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>
                      {t(
                        `logStatus.${LOG_STATUS_BADGE_META[entry.status].labelKey}` as Parameters<typeof t>[0],
                      )}
                    </Tag>
                    <Text>{entry.channel}</Text>
                    <Text type="secondary">{entry.template_key}</Text>
                    <Text type="secondary">
                      {/* Pin tz + 24h: Node vs browser ICU render the ko-KR
                          day-period differently ("PM"/"오후") → React #418. */}
                      {new Date(
                        entry.sent_at ?? entry.created_at,
                      ).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        hour12: false,
                      })}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          )}
        </AppCard>

        <Alert type="info" showIcon title={t("deferredNotice")} />

        {/* Region 5: 저장 CTA (변경값 없으면 비활성, 저장 중 중복 클릭 차단) */}
        <Form.Item className="!mb-0">
          <Button
            data-testid="notification-save"
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!isDirty || saving || settingsLoad.status !== "ready"}
          >
            {tCommon("save")}
          </Button>
        </Form.Item>
      </div>
    </Form>
  );
}
