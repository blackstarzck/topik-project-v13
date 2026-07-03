"use client";

import {
  Alert,
  App,
  Button,
  Empty,
  List,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchNotifications,
  markNotificationRead,
  resolveNotificationDestination,
  type UserNotification,
} from "@/components/notifications/notifications-data";
import { AppCard } from "@/components/shared/AppCard";
import { MANUAL_RETRY_COOLDOWN_MS } from "@/lib/request-control/policies";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";

const { Text } = Typography;

// 대시보드 공지사항 항목 5개 이하 (하드 캡).
const NOTIFICATION_LIMIT = 5;

// category enum → 카탈로그 키(enum 값은 그대로 유지).
const CATEGORY_LABEL_KEYS: Record<UserNotification["category"], string> = {
  study: "study",
  exam_schedule: "examSchedule",
  notice: "notice",
  event: "event",
  marketing: "marketing",
};

type NotificationLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error" };

type Props = {
  /** 공지 클릭 시 읽음 처리에 필요한 소유자 id (서버 레이아웃에서 전달). */
  userId: string;
  /** 공지사항 로드 실패 여부 — true면 재시도 CTA. */
  loadFailed?: boolean;
};

/**
 * B-01 area 4 — 공지사항 보조 영역.
 *
 * 플로팅 알림함과 역할이 겹치지 않도록 notice category만 표시한다.
 * 읽음 규칙: 항목 클릭 = 읽음 처리 후 이동경로가 있으면 이동(NotificationBell과 동일).
 *
 * 제약 조건: 공지사항 항목 5개 이하, 날짜 표기는 로케일 기준.
 * 예외: 공지사항 로드 실패 시 재시도 CTA 제공.
 */
export function DashboardAlertsCard({ userId, loadFailed = false }: Props) {
  const t = useTranslations("dashboard.alerts");
  const format = useFormatter();
  const router = useRouter();
  const { message } = App.useApp();

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notifLoad, setNotifLoad] = useState<NotificationLoad>({
    status: "loading",
  });
  // 재시도 버튼이 올리는 키 — effect 재실행으로 refetch (NotificationPrefsForm 패턴).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchNotifications(userId, NOTIFICATION_LIMIT, {
          category: "notice",
        });
        if (cancelled) return;
        setNotifications(list.filter((item) => item.category === "notice"));
        setNotifLoad({ status: "ready" });
      } catch {
        if (!cancelled) setNotifLoad({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  async function handleNotificationClick(item: UserNotification) {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: readAt } : n)),
      );
      try {
        await markNotificationRead(item.id);
      } catch (err) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: null } : n)),
        );
        message.error(
          err instanceof Error ? err.message : t("loadFailedMessage"),
        );
      }
    }
    const destination = resolveNotificationDestination(item);
    if (destination) router.push(destination as never);
  }

  const failed = loadFailed || notifLoad.status === "error";
  const empty = notifLoad.status === "ready" && notifications.length === 0;
  const retry = useSingleFlightAction(
    () => {
      setNotifLoad({ status: "loading" });
      setReloadKey((k) => k + 1);
      router.refresh();
    },
    { cooldownMs: MANUAL_RETRY_COOLDOWN_MS },
  );

  return (
    <AppCard className="dashboard-alerts-card" title={t("cardTitle")}>
      {failed ? (
        <div className="grid gap-3">
          <Alert
            type="warning"
            showIcon
            title={t("loadFailedMessage")}
            description={t("loadFailedDescription")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="primary"
              loading={retry.pending}
              disabled={retry.pending}
              onClick={() => void retry.run()}
            >
              {t("retry")}
            </Button>
          </div>
        </div>
      ) : empty ? (
        <Empty description={t("empty")} />
      ) : (
        <div className="grid gap-3">
          {notifLoad.status === "loading" ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : notifications.length > 0 ? (
            <List
              size="small"
              dataSource={notifications}
              renderItem={(item) => {
                const unread = !item.read_at;
                return (
                  <List.Item
                    className={
                      unread
                        ? "app-notification-feed-item app-notification-feed-item--unread"
                        : "app-notification-feed-item"
                    }
                  >
                    <button
                      type="button"
                      className="app-notification-feed-item__button"
                      onClick={() => void handleNotificationClick(item)}
                    >
                      <Tag className="app-notification-feed-item__tag">
                        {t(
                          `category.${CATEGORY_LABEL_KEYS[item.category]}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </Tag>
                      <Text className="app-notification-feed-item__title">
                        {item.title}
                      </Text>
                      <Text
                        type="secondary"
                        className="app-notification-feed-item__time"
                      >
                        {format.dateTime(new Date(item.created_at), {
                          dateStyle: "medium",
                        })}
                      </Text>
                    </button>
                  </List.Item>
                );
              }}
            />
          ) : null}
        </div>
      )}
    </AppCard>
  );
}
