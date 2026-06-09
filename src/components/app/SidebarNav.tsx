"use client";

import { Menu, Tag, Tooltip, type MenuProps } from "antd";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { type AppRole } from "@/lib/auth/roles";
import {
  computeSidebarLocks,
  SIDEBAR_ITEMS,
  type SidebarItem,
  type SidebarLeaf,
  type SidebarLockMap,
} from "@/lib/routes";

type Props = {
  role: AppRole;
  /** profiles.plan_label — 플랜 기반 잠금 판정에 사용. */
  planLabel?: string | null;
  /** 모바일 Drawer 안에서 메뉴 클릭 시 Drawer 를 닫기 위한 콜백. */
  onNavigate?: () => void;
};

type MenuItems = MenuProps["items"];

/**
 * Translator scoped to the `nav` message namespace. next-intl's type
 * augmentation narrows the accepted key to the known `nav` keys, so we derive
 * the exact translator + key types here. The sidebar data module carries
 * `labelKey`/lock values as plain `string` (it must stay i18n-import-free, see
 * routes.ts), so we cast those strings to `NavKey` at the single call site.
 */
type NavTranslate = ReturnType<typeof useTranslations<"nav">>;
type NavKey = Parameters<NavTranslate>[0];

/**
 * B-01 area 1 예외 — 권한/플랜 잠금 메뉴는 숨기거나 활성화하지 않고
 * **비활성(disabled) + 잠금 사유**로 렌더한다. 색상만으로 의미를 전달하지
 * 않도록 사유를 텍스트(Tag)와 Tooltip 으로 함께 노출한다.
 */
function lockedLeafLabel(label: string, reason: string) {
  return (
    <Tooltip title={`${label} · ${reason}`} placement="right">
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        aria-label={`${label}, ${reason}`}
      >
        <Lock aria-hidden size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span>{label}</span>
        <Tag
          style={{ marginInlineStart: "auto", fontSize: 11, lineHeight: "16px" }}
        >
          {reason}
        </Tag>
      </span>
    </Tooltip>
  );
}

function buildLeaf(leaf: SidebarLeaf, locks: SidebarLockMap, t: NavTranslate) {
  const label = t(leaf.labelKey as NavKey);
  const lockKey = locks[leaf.key];
  if (lockKey) {
    const reason = t(lockKey as NavKey);
    return {
      key: leaf.key,
      label: lockedLeafLabel(label, reason),
      disabled: true,
      title: `${label} (${reason})`,
    };
  }
  return { key: leaf.key, label };
}

function buildItem(
  item: SidebarItem,
  locks: SidebarLockMap,
  t: NavTranslate,
): NonNullable<MenuItems>[number] {
  if ("children" in item) {
    return {
      key: item.key,
      label: t(item.labelKey as NavKey),
      children: item.children.map((child) => buildLeaf(child, locks, t)),
    };
  }
  return buildLeaf(item, locks, t);
}

export function SidebarNav({ role, planLabel, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  const locks = useMemo<SidebarLockMap>(
    () => computeSidebarLocks({ role, planLabel: planLabel ?? null }),
    [role, planLabel],
  );

  const items = useMemo<MenuItems>(() => {
    return SIDEBAR_ITEMS.map((item) => buildItem(item, locks, t));
  }, [locks, t]);

  // 현재 위치 표시 — 정확 일치 우선, 없으면 가장 긴 접두 일치(중첩 라우트).
  const selectedKey = useMemo(() => {
    const pathKeys: string[] = [];
    const collect = (list: readonly SidebarItem[]) => {
      for (const it of list) {
        if ("children" in it) collect(it.children);
        else if (it.key.startsWith("/")) pathKeys.push(it.key);
      }
    };
    collect(SIDEBAR_ITEMS);
    if (pathKeys.includes(pathname)) return pathname;
    const prefixMatch = pathKeys
      .filter((k) => pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0];
    return prefixMatch ?? pathname;
  }, [pathname]);

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      onClick={({ key }) => {
        if (typeof key === "string" && key.startsWith("/")) {
          router.push(key);
          onNavigate?.();
        }
      }}
      items={items}
      style={{ height: "100%", borderInlineEnd: 0 }}
    />
  );
}
