"use client";

import { App, Badge, Button, Empty, List, Popover, Skeleton, Typography } from "antd";
import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "./notifications-data";

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
 *   and then follows link_url when present. Same rule as the dashboard card.
 * - Unread = dot + bold title + subtle background, never color alone.
 */
export function NotificationBell({ userId }: Props) {
  const t = useTranslations("notifications.bell");
  const format = useFormatter();
  const router = useRouter();
  const { message } = App.useApp();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [listLoad, setListLoad] = useState<ListLoad>({ status: "loading" });

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
        message.error(
          err instanceof Error ? err.message : t("markReadError"),
        );
      }
    }
    if (item.link_url) {
      setOpen(false);
      router.push(item.link_url as never);
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

  const content = (
    <div className="app-notification-panel">
      <div className="app-notification-panel__header">
        <Text strong>{t("title")}</Text>
        <Button
          type="link"
          size="small"
          disabled={unreadCount === 0}
          onClick={() => void handleMarkAll()}
        >
          {t("markAllRead")}
        </Button>
      </div>
      {listLoad.status === "loading" ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : listLoad.status === "error" ? (
        <div className="app-notification-panel__error">
          <Text type="danger">{t("loadError")}</Text>
          <Button size="small" onClick={() => void loadList()}>
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
                  onClick={() => void handleItemClick(item)}
                >
                  <span className="app-notification-item__dot" aria-hidden>
                    {unread ? <Badge status="processing" /> : null}
                  </span>
                  <span className="app-notification-item__content">
                    <Text strong={unread}>{item.title}</Text>
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      className="!m-0 !text-xs"
                    >
                      {item.body}
                    </Paragraph>
                    <Text type="secondary" className="!text-xs">
                      {format.relativeTime(new Date(item.created_at))}
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
        if (next) void loadList();
      }}
      trigger="click"
      placement="bottomRight"
      content={content}
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
