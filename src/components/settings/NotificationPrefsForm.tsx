"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Space,
  Switch,
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";

import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "@/lib/settings/types";
import { useUpdateNotificationPrefs } from "@/lib/settings/mutations";

const { Text } = Typography;

const UNSAVED_NOTIFICATION_LEAVE_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠어요?";

const PREF_LABELS: Record<NotificationPrefKey, string> = {
  weekly_summary: "주간 학습 요약",
  feedback_ready: "피드백 준비 완료 알림",
  study_reminder: "학습 리마인더",
};

type Props = {
  /**
   * See `LanguageForm` for the rationale on accepting `userId` as a prop —
   * `useUpdateNotificationPrefs` is per-user and the data layer is read-only.
   */
  userId: string;
  initialPrefs: Partial<Record<NotificationPrefKey, boolean>>;
};

/**
 * Compute the diff between current form values and the initial server
 * snapshot. Missing keys in `initialPrefs` are treated as `false` (matches
 * `coerceNotificationPrefs` semantics in `src/lib/settings/types.ts`). Only
 * keys whose value differs are included in the patch — the mutation hook
 * still merges via read-modify-write, but the tight payload keeps audit logs
 * focused on what the user actually changed.
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

export function NotificationPrefsForm({ userId, initialPrefs }: Props) {
  const { message } = App.useApp();
  const mutation = useUpdateNotificationPrefs(userId);

  const [values, setValues] = useState<NotificationPrefs>(() => {
    const seed: NotificationPrefs = {};
    for (const key of NOTIFICATION_PREF_KEYS) {
      seed[key] = initialPrefs[key] ?? false;
    }
    return seed;
  });

  // Region 3 (알림 조건 입력): reminder time is shown so the documented HH:mm
  // input exists, but it is NOT persisted — the Phase 6 notification_prefs
  // schema only stores the 3 booleans and the data layer is read-only here.
  // The transport-deferred banner makes this honest; we never claim the time
  // is saved or that a reminder will actually be sent.
  const [reminderTime, setReminderTime] = useState<Dayjs | null>(null);

  // dirty only reflects the persisted booleans (the only saved fields).
  const isDirty = NOTIFICATION_PREF_KEYS.some(
    (key) => (values[key] ?? false) !== (initialPrefs[key] ?? false),
  );

  function setKey(key: NotificationPrefKey, value: boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
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
    const diff = computeNotificationDiff(values, initialPrefs);
    try {
      await mutation.mutateAsync(diff);
      message.success("알림 설정이 저장되었습니다.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "저장에 실패했어요.",
      );
    }
  }

  const reminderPreview =
    reminderTime != null
      ? `매일 ${reminderTime.format("HH:mm")}에 학습 리마인더를 보낼 예정입니다.`
      : "학습 리마인더 시간을 설정하면 발송 예시가 표시됩니다.";

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* Region 2: 알림 채널 탭 (이메일 / Zalo) */}
        <Card size="small" title="알림 채널">
          <Tabs
            items={[
              {
                key: "email",
                label: "이메일",
                children: (
                  <Text type="secondary">
                    가입 이메일로 알림을 받습니다. (전송 기능 준비 중)
                  </Text>
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
                disabled: true,
                children: (
                  <Text type="secondary">
                    Zalo 연동은 준비 중입니다.
                  </Text>
                ),
              },
            ]}
          />
        </Card>

        {/* Region 3: 알림 조건 입력 (조건 토글 + 리마인더 시간 HH:mm) */}
        <Card size="small" title="알림 조건">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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

            <Form.Item
              label="리마인더 시간"
              style={{ marginBottom: 0 }}
              extra="시간 설정은 미리보기용이며 아직 저장되지 않습니다."
            >
              <TimePicker
                value={reminderTime}
                onChange={(value) => setReminderTime(value)}
                format="HH:mm"
                minuteStep={5}
                placeholder="HH:mm"
                aria-label="리마인더 시간"
              />
            </Form.Item>
          </Space>
        </Card>

        {/* Region 4: 미리보기 / 도움말 */}
        <Card size="small" title="미리보기">
          <Text type="secondary">{reminderPreview}</Text>
        </Card>

        <Alert
          type="info"
          showIcon
          message="알림 전송 인프라는 준비 중입니다. 지금은 알림 조건(켜짐/꺼짐)만 저장되며, 실제 알림은 발송되지 않습니다."
        />

        {/* Region 5: 저장 CTA (변경값 없으면 비활성) */}
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
