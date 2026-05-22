"use client";

import { Alert, App, Button, Form, Space, Switch, Typography } from "antd";
import { useState } from "react";

import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
  type NotificationPrefs,
} from "@/lib/settings/types";
import { useUpdateNotificationPrefs } from "@/lib/settings/mutations";

const { Text } = Typography;

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

  function setKey(key: NotificationPrefKey, value: boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

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

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {NOTIFICATION_PREF_KEYS.map((key) => (
          <Form.Item key={key} label={PREF_LABELS[key]} style={{ marginBottom: 0 }}>
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

        <Alert
          type="info"
          showIcon
          message="알림 전송 인프라는 곧 도입됩니다. 지금은 환경설정만 저장됩니다."
        />

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
          >
            저장
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
