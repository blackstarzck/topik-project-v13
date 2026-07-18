"use client";

import { App, Badge, Button, Empty, Popover, Skeleton, Typography } from "antd";
import { Bell } from "@/components/shared/AppIcons";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { APP_ROUTES } from "@/lib/routes";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  mapInstitutionInvitationError,
  markAllNotificationsRead,
  markNotificationRead,
  resolveInstitutionInvitationStatus,
  resolveInstitutionInvitationExpiry,
  resolveNotificationAction,
  respondInstitutionInvitation,
  type InstitutionInvitationPayload,
  type UserNotification,
} from "./notifications-data";
import {
  InstitutionInvitationModal,
  type InstitutionInvitationModalStatus,
} from "./InstitutionInvitationModal";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";
import {
  createClientOperationalEvent,
  emitClientOperationalEvent,
} from "@/lib/operations/client-operational-event";

const { Paragraph, Text } = Typography;

const UNREAD_POLL_MS = 60_000;
const INBOX_LIMIT = 20;

type ListLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type Props = {
  userId: string;
  affiliationCode?: string | null;
};

type InvitationSubmitAction = "accept";

type InvitationModalState = {
  invitation: InstitutionInvitationPayload;
  status: InstitutionInvitationModalStatus;
};

function recordNotificationFailure(
  operation: "load" | "mark_read" | "mark_all_read",
) {
  const created = createClientOperationalEvent({
    code: "operation_failed",
    feature: "notification_inbox",
    operation,
    result: "failure",
  });
  if (created.ok) void emitClientOperationalEvent(created.event);
}

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
export function NotificationBell({ userId, affiliationCode }: Props) {
  const t = useTranslations("notifications.bell");
  const tInvitation = useTranslations("notifications.institutionInvitation");
  const format = useFormatter();
  // relativeTime은 now가 없으면 호출마다 IntlError(ENVIRONMENT_FALLBACK)를 던진다
  // (dev 콘솔 폭주 — QA 2차 라운드에서 발견). 1분 주기로 갱신되는 now를 공급한다.
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [listLoad, setListLoad] = useState<ListLoad>({ status: "loading" });
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [invitationModal, setInvitationModal] =
    useState<InvitationModalState | null>(null);
  const [invitationSubmitting, setInvitationSubmitting] =
    useState<InvitationSubmitAction | null>(null);
  const handledOpenQueryRef = useRef<string | null>(null);

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
    } catch {
      recordNotificationFailure("load");
      setListLoad({
        status: "error",
        message: t("loadError"),
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
      } catch {
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: null } : n)),
        );
        setUnreadCount((prev) => prev + 1);
        recordNotificationFailure("mark_read");
        message.error(t("markReadError"));
      } finally {
        pendingReadIdsRef.current.delete(item.id);
        setPendingReadIds(new Set(pendingReadIdsRef.current));
      }
    }
    const action = resolveNotificationAction(item);
    if (action.kind === "institutionInvitation") {
      setOpen(false);
      setInvitationModal({
        invitation: action.invitation,
        status: null,
      });
      return;
    }
    if (action.kind === "route") {
      setOpen(false);
      router.push(action.href as never);
    }
  }

  async function handleInvitationResponse() {
    const invitationId = invitationModal?.invitation.invitationId;
    if (!invitationId) return;
    if (
      resolveInstitutionInvitationExpiry(
        invitationModal.invitation.expiresAt,
        new Date(),
      ).status === "expired"
    ) {
      setInvitationModal((prev) =>
        prev ? { ...prev, status: "expired" } : prev,
      );
      return;
    }

    setInvitationSubmitting("accept");
    try {
      const result = await respondInstitutionInvitation(invitationId, true);
      const status = resolveInstitutionInvitationStatus(result);
      setInvitationModal((prev) => {
        if (!prev) return prev;
        return {
          invitation: {
            invitationId,
            code: result.code ?? prev.invitation.code,
            codeLabel: result.code_label ?? prev.invitation.codeLabel,
            expiresAt: prev.invitation.expiresAt,
          },
          status,
        };
      });
      if (status === "accepted") {
        message.success(tInvitation("accepted"));
        router.refresh();
      } else if (status === "declined") {
        message.info(tInvitation("declined"));
      }
    } catch (err) {
      const status = mapInstitutionInvitationError(err);
      setInvitationModal((prev) => (prev ? { ...prev, status } : prev));
    } finally {
      setInvitationSubmitting(null);
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
    } catch {
      recordNotificationFailure("mark_all_read");
      message.error(t("markAllError"));
    }
  }
  const { pending: reloadListPending, run: reloadList } =
    useSingleFlightAction(loadList);
  const markAll = useSingleFlightAction(handleMarkAll);

  useEffect(() => {
    const query = searchParams.toString();
    if (searchParams.get("openNotifications") !== "1") {
      handledOpenQueryRef.current = null;
      return;
    }
    if (handledOpenQueryRef.current === query) return;

    handledOpenQueryRef.current = query;
    setOpen(true);
    void reloadList();

    const nextParams = new URLSearchParams(query);
    nextParams.delete("openNotifications");
    const nextQuery = nextParams.toString();
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextHref as never, { scroll: false } as never);
  }, [pathname, reloadList, router, searchParams]);

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
            loading={reloadListPending}
            disabled={reloadListPending}
            onClick={() => void reloadList()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />
      ) : (
        <div className="app-notification-list" role="list">
          {items.map((item) => {
            const unread = !item.read_at;
            const isPendingRead = pendingReadIds.has(item.id);
            const action = resolveNotificationAction(item);
            const institutionInvitation =
              action.kind === "institutionInvitation"
                ? action.invitation
                : null;
            const invitationExpiry = institutionInvitation
              ? resolveInstitutionInvitationExpiry(
                  institutionInvitation.expiresAt,
                  now,
                )
              : null;
            const expiryLabel =
              invitationExpiry?.status === "expired"
                ? tInvitation("expiredLabel")
                : invitationExpiry?.status === "active"
                  ? tInvitation("expiresInDays", {
                      days: invitationExpiry.daysRemaining,
                    })
                  : null;
            return (
              <div
                key={item.id}
                role="listitem"
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
                    <span className="app-notification-item__meta flex min-w-0 items-center gap-2">
                      <Text
                        type="secondary"
                        className="app-notification-item__time"
                      >
                        {format.relativeTime(new Date(item.created_at), now)}
                      </Text>
                      {expiryLabel ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="app-notification-item__separator"
                          >
                            ·
                          </span>
                          <Text
                            type={
                              invitationExpiry?.status === "expired"
                                ? "danger"
                                : "secondary"
                            }
                            className="app-notification-item__expiry"
                          >
                            {expiryLabel}
                          </Text>
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void reloadList();
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
      <InstitutionInvitationModal
        open={Boolean(invitationModal)}
        invitation={invitationModal?.invitation ?? null}
        affiliationCode={affiliationCode}
        status={invitationModal?.status ?? null}
        submitting={invitationSubmitting}
        onAccept={() => void handleInvitationResponse()}
        onSignIn={() => router.push(APP_ROUTES.login as never)}
        onClose={() => {
          setInvitationModal(null);
          setInvitationSubmitting(null);
        }}
      />
    </>
  );
}
