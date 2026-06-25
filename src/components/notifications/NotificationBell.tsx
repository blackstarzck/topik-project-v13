"use client";

import {
  App,
  Badge,
  Button,
  Empty,
  List,
  Popover,
  Skeleton,
  Typography,
} from "antd";
import { Bell } from "@/components/shared/AppIcons";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationDestination,
  type UserNotification,
} from "./notifications-data";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";

const { Paragraph, Text } = Typography;

const UNREAD_POLL_MS = 60_000;
const INBOX_LIMIT = 20;

type ListLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type Props = {
  userId: string;
};

/**
 * Workspace notification bell + popover inbox (user_notifications).
 *
 * - Badge polls the unread count every 60s; the inbox list refetches each time
 *   the popover opens (no realtime subscription — polling is enough here).
 * - Read rule: clicking an item marks it read (optimistic, reverted on error)
 *   and then follows the movement path when present. Same rule as the
 *   dashboard card.
 * - Unread = dot indicator; the row surface stays transparent.
 */
export function NotificationBell({ userId }: Props) {
  const t = useTranslations("notifications.bell");
  const format = useFormatter();
  // relativeTime은 now가 없으면 호출마다 IntlError(ENVIRONMENT_FALLBACK)를 던진다
  // (dev 콘솔 폭주 — QA 2차 라운드에서 발견). 1분 주기로 갱신되는 now를 공급한다.
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const { message } = App.useApp();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [listLoad, setListLoad] = useState<ListLoad>({ status: "loading" });
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    const refreshCount = async () => {
      try {
        const count = await fetchUnreadNotificationCount(userId);
        if (!cancelled) setUnreadCount(count);
      } catch {
        // Badge poll failures stay silent — the popover surfaces load errors.
      }
    };
    void refreshCount();
    const timer = setInterval(() => void refreshCount(), UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId]);

  const loadList = useCallback(async () => {
    setListLoad({ status: "loading" });
    try {
      const [list, count] = await Promise.all([
        fetchNotifications(userId, INBOX_LIMIT),
        fetchUnreadNotificationCount(userId),
      ]);
      setItems(list);
      setUnreadCount(count);
      setListLoad({ status: "ready" });
    } catch (err) {
      setListLoad({
        status: "error",
        message: err instanceof Error ? err.message : t("loadError"),
      });
    }
  }, [userId, t]);

  async function handleItemClick(item: UserNotification) {
    if (!item.read_at) {
      if (pendingReadIdsRef.current.has(item.id)) return;
      pendingReadIdsRef.current.add(item.id);
      setPendingReadIds(new Set(pendingReadIdsRef.current));
      const readAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: readAt } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(item.id);
      } catch (err) {
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: null } : n)),
        );
        setUnreadCount((prev) => prev + 1);
        message.error(err instanceof Error ? err.message : t("markReadError"));
      } finally {
        pendingReadIdsRef.current.delete(item.id);
        setPendingReadIds(new Set(pendingReadIdsRef.current));
      }
    }
    const destination = resolveNotificationDestination(item);
    if (destination) {
      setOpen(false);
      router.push(destination as never);
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead(userId);
      const readAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
      );
      setUnreadCount(0);
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("markAllError"));
    }
  }
  const reloadList = useSingleFlightAction(loadList);
  const markAll = useSingleFlightAction(handleMarkAll);

  const content = (
    <div className="app-notification-panel">
      <div className="app-notification-panel__header">
        <Text strong>{t("title")}</Text>
        <Button
          type="link"
          size="small"
          className="app-notification-panel__mark-all"
          loading={markAll.pending}
          disabled={unreadCount === 0 || markAll.pending}
          onClick={() => void markAll.run()}
        >
          {t("markAllRead")}
        </Button>
      </div>
      {listLoad.status === "loading" ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : listLoad.status === "error" ? (
        <div className="app-notification-panel__error">
          <Text type="danger">{t("loadError")}</Text>
          <Button
            size="small"
            loading={reloadList.pending}
            disabled={reloadList.pending}
            onClick={() => void reloadList.run()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />
      ) : (
        <List
          className="app-notification-list"
          size="small"
          dataSource={items}
          renderItem={(item) => {
            const unread = !item.read_at;
            const isPendingRead = pendingReadIds.has(item.id);
            return (
              <List.Item
                className={
                  unread
                    ? "app-notification-item app-notification-item--unread"
                    : "app-notification-item"
                }
              >
                <button
                  type="button"
                  className="app-notification-item__button"
                  disabled={isPendingRead}
                  onClick={() => void handleItemClick(item)}
                >
                  <span className="app-notification-item__dot" aria-hidden>
                    {unread ? (
                      <span className="app-notification-item__unread-dot" />
                    ) : null}
                  </span>
                  <span className="app-notification-item__content">
                    <Text className="app-notification-item__title">
                      {item.title}
                    </Text>
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      className="app-notification-item__body !m-0"
                    >
                      {item.body}
                    </Paragraph>
                    <Text
                      type="secondary"
                      className="app-notification-item__time"
                    >
                      {format.relativeTime(new Date(item.created_at), now)}
                    </Text>
                  </span>
                </button>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void reloadList.run();
      }}
      trigger="click"
      placement="bottomRight"
      content={content}
      classNames={{ root: "app-notification-popover" }}
    >
      <Badge count={unreadCount} overflowCount={99} size="small">
        <Button
          type="text"
          className="app-notification-bell"
          aria-label={t("bellAria")}
          icon={<Bell aria-hidden size={20} />}
        />
      </Badge>
    </Popover>
  );
}
