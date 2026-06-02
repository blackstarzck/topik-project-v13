"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  List,
  Skeleton,
  Space,
  Switch,
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";

import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "@/lib/settings/types";
import { useUpdateNotificationPrefs } from "@/lib/settings/mutations";
import {
  fetchNotificationLog,
  fetchNotificationSettings,
  upsertNotificationSettings,
  NOTIFICATION_SETTINGS_DEFAULTS,
  type NotificationChannels,
  type NotificationLogEntry,
  type NotificationSettings,
} from "./learning-settings-data";

const { Text } = Typography;

const UNSAVED_NOTIFICATION_LEAVE_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠어요?";

const PREF_LABELS: Record<NotificationPrefKey, string> = {
  weekly_summary: "주간 학습 요약",
  feedback_ready: "피드백 준비 완료 알림",
  study_reminder: "학습 리마인더",
};

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const LOG_STATUS_META: Record<
  NotificationLogEntry["status"],
  { label: string; color: string }
> = {
  sent: { label: "발송됨", color: "green" },
  failed: { label: "실패", color: "red" },
  pending: { label: "대기", color: "blue" },
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
 * - Region 4 (미리보기/도움말): preview copy + 발송 이력 5개 from notification_log.
 * - Region 5 (저장): dirty-gated, double-click guarded.
 * - 수신 권한 없음 notice when both channels off.
 * - The 3 boolean conditions still persist to profiles.notification_prefs.
 * - REAL SEND is an external stub (no transport) — preview/log only.
 */
export function NotificationPrefsForm({ userId, initialPrefs }: Props) {
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
  const [log, setLog] = useState<NotificationLogEntry[]>([]);
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
          fetchNotificationLog(userId, 5).catch(() => []),
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
          message:
            err instanceof Error
              ? err.message
              : "알림 설정을 불러오지 못했어요.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

      if (!window.confirm(UNSAVED_NOTIFICATION_LEAVE_MESSAGE)) {
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
      // Always persist the boolean conditions (the merge tolerates an empty
      // diff) so the form's submit contract stays simple and predictable.
      await prefsMutation.mutateAsync(
        computeNotificationDiff(values, initialPrefs),
      );
      if (settingsDirty) {
        await upsertNotificationSettings(userId, settings);
        setSavedSettings(settings);
      }
      message.success("알림 설정이 저장되었습니다.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const reminderPreview = reminderTime
    ? `매일 ${reminderTime.format("HH:mm")} (${settings.timezone})에 학습 리마인더를 보낼 예정입니다.`
    : "학습 리마인더 시간을 설정하면 발송 예시가 표시됩니다.";

  const channelTabs = [
    {
      key: "email",
      label: "이메일",
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Checkbox
            checked={settings.channels.email}
            onChange={(e) => setChannel("email", e.target.checked)}
          >
            이메일 알림 받기
          </Checkbox>
          <Text type="secondary">가입 이메일로 알림을 받습니다.</Text>
        </Space>
      ),
    },
    {
      key: "zalo",
      label: (
        <Space size={4}>
          Zalo
          <Tag>미연동</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Checkbox
            checked={settings.channels.zalo}
            onChange={(e) => setChannel("zalo", e.target.checked)}
          >
            Zalo 알림 받기
          </Checkbox>
          <Text type="secondary">
            Zalo 연동(실제 발송)은 준비 중입니다. 지금은 수신 설정만 저장돼요.
          </Text>
        </Space>
      ),
    },
    {
      key: "both",
      label: "둘 다",
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Checkbox
            checked={settings.channels.email}
            onChange={(e) => setChannel("email", e.target.checked)}
          >
            이메일 알림 받기
          </Checkbox>
          <Checkbox
            checked={settings.channels.zalo}
            onChange={(e) => setChannel("zalo", e.target.checked)}
          >
            Zalo 알림 받기 (연동 예정)
          </Checkbox>
        </Space>
      ),
    },
  ];

  return (
    <Form layout="vertical" onFinish={handleFinish} disabled={saving}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {settingsLoad.status === "error" ? (
          <Alert
            type="error"
            showIcon
            message="알림 설정을 불러오지 못했어요"
            description={settingsLoad.message}
          />
        ) : null}

        {/* 수신 권한 없음 notice (both channels off) */}
        {settingsLoad.status === "ready" && !anyChannelOn ? (
          <Alert
            type="warning"
            showIcon
            message="수신 중인 알림 채널이 없습니다"
            description="아래에서 이메일 또는 Zalo 채널을 켜야 리마인더를 받을 수 있어요."
          />
        ) : null}

        {/* Region 2: 알림 채널 탭 (이메일 / Zalo / 둘 다) */}
        <Card size="small" title="알림 채널">
          {settingsLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Tabs
              activeKey={activeChannel}
              onChange={(k) => setActiveChannel(k as "email" | "zalo" | "both")}
              items={channelTabs}
            />
          )}
        </Card>

        {/* Region 3: 알림 조건 입력 */}
        <Card size="small" title="알림 조건">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {/* Boolean conditions persist to profiles.notification_prefs and do
                not depend on the async notification_settings load. */}
            {NOTIFICATION_PREF_KEYS.map((key) => (
              <Form.Item
                key={key}
                label={PREF_LABELS[key]}
                style={{ marginBottom: 0 }}
              >
                <Switch
                  checked={values[key] ?? false}
                  onChange={(checked) => setKey(key, checked)}
                  aria-label={PREF_LABELS[key]}
                />
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  {values[key] ? "켜짐" : "꺼짐"}
                </Text>
              </Form.Item>
            ))}

            {/* Schedule (time/days) needs the loaded notification_settings. */}
            {settingsLoad.status === "loading" ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Form.Item
                  label="리마인더 시간 (HH:mm)"
                  style={{ marginBottom: 0 }}
                  extra={
                    anyChannelOn
                      ? undefined
                      : "수신 채널을 켜면 리마인더 시간을 설정할 수 있어요."
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
                    aria-label="리마인더 시간"
                  />
                </Form.Item>

                <Form.Item label="리마인더 요일" style={{ marginBottom: 0 }}>
                  <Space wrap>
                    {WEEKDAYS.map((d) => (
                      <Tag.CheckableTag
                        key={d.value}
                        checked={settings.reminder_days.includes(d.value)}
                        onChange={() => anyChannelOn && toggleDay(d.value)}
                        style={
                          anyChannelOn
                            ? undefined
                            : { opacity: 0.5, cursor: "not-allowed" }
                        }
                      >
                        {d.label}
                      </Tag.CheckableTag>
                    ))}
                  </Space>
                </Form.Item>
              </>
            )}
          </Space>
        </Card>

        {/* Region 4: 미리보기 / 발송 이력 */}
        <Card size="small" title="미리보기">
          <Text type="secondary">{reminderPreview}</Text>
        </Card>

        <Card size="small" title="발송 이력 (최근 5건)">
          {settingsLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : log.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="아직 발송된 알림이 없습니다."
            />
          ) : (
            <List
              size="small"
              dataSource={log}
              renderItem={(entry) => (
                <List.Item>
                  <Space>
                    <Tag color={LOG_STATUS_META[entry.status].color}>
                      {LOG_STATUS_META[entry.status].label}
                    </Tag>
                    <Text>{entry.channel}</Text>
                    <Text type="secondary">{entry.template_key}</Text>
                    <Text type="secondary">
                      {new Date(
                        entry.sent_at ?? entry.created_at,
                      ).toLocaleString("ko-KR")}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>

        <Alert
          type="info"
          showIcon
          message="실제 알림 발송 연동은 준비 중입니다. 지금은 수신 채널·조건·시간이 저장되며, 발송 이력은 발송이 시작되면 채워집니다."
        />

        {/* Region 5: 저장 CTA (변경값 없으면 비활성, 저장 중 중복 클릭 차단) */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!isDirty || saving || settingsLoad.status !== "ready"}
          >
            저장
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
