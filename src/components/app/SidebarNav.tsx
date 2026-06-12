"use client";

import { Menu, Tag, Tooltip, type MenuProps } from "antd";
import {
  BarChart3,
  Bell,
  BookOpen,
  GraduationCap,
  Home,
  Languages,
  Library,
  Lightbulb,
  ListChecks,
  Lock,
  PenLine,
  Settings,
  Target,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import type { AppRole } from "@/lib/auth/roles";
import {
  computeSidebarLocks,
  SIDEBAR_ITEMS,
  type SidebarItem,
  type SidebarLeaf,
  type SidebarLockMap,
} from "@/lib/routes";

type Props = {
  role: AppRole;
  planLabel?: string | null;
  onNavigate?: () => void;
};

type MenuItems = MenuProps["items"];
type MenuItem = NonNullable<MenuItems>[number];
type NavTranslate = ReturnType<typeof useTranslations<"nav">>;
type NavKey = Parameters<NavTranslate>[0];

function lockedLeafLabel(label: string, reason: string) {
  return (
    <Tooltip title={`${label} - ${reason}`} placement="right">
      <span
        className="app-sidebar-lock-label"
        aria-label={`${label}, ${reason}`}
      >
        <Lock aria-hidden className="app-sidebar-lock-icon" size={12} />
        <span>{label}</span>
        <Tag className="app-sidebar-lock-tag">{reason}</Tag>
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
      icon: navIcon(leaf.key),
      disabled: true,
      title: `${label} (${reason})`,
    };
  }

  return { key: leaf.key, label, icon: navIcon(leaf.key) };
}

function buildItem(
  item: SidebarItem,
  locks: SidebarLockMap,
  t: NavTranslate,
): MenuItem {
  if ("children" in item) {
    return {
      key: item.key,
      label: t(item.labelKey as NavKey),
      icon: navIcon(item.key),
      children: item.children.map((child) => buildLeaf(child, locks, t)),
    };
  }

  return buildLeaf(item, locks, t);
}

function navIcon(key: string) {
  const props = { "aria-hidden": true, size: 17, strokeWidth: 1.8 };

  if (key === "/dashboard") return <Home {...props} />;
  if (key === "practice") return <BookOpen {...props} />;
  if (key === "/practice/recommendations") return <Lightbulb {...props} />;
  if (key === "/practice/problems") return <ListChecks {...props} />;
  if (key === "/practice/next") return <Target {...props} />;
  if (key === "/practice/weakness") return <BarChart3 {...props} />;
  if (key === "writing" || key.startsWith("/writing/")) {
    return <PenLine {...props} />;
  }
  if (key === "/library") return <Library {...props} />;
  if (key === "/growth") return <BarChart3 {...props} />;
  if (key === "/profile") return <UserRound {...props} />;
  if (key === "settings") return <Settings {...props} />;
  if (key === "/settings/language") return <Languages {...props} />;
  if (key === "/settings/notifications") return <Bell {...props} />;

  return null;
}

function TextLike({
  children,
  strong,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return strong ? <strong>{children}</strong> : <span>{children}</span>;
}

export function SidebarNav({ role, planLabel, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const tApp = useTranslations("app");
  const t = useTranslations("nav");

  const locks = useMemo<SidebarLockMap>(
    () => computeSidebarLocks({ role, planLabel: planLabel ?? null }),
    [role, planLabel],
  );

  const items = useMemo<MenuItems>(() => {
    return SIDEBAR_ITEMS.map((item) => buildItem(item, locks, t));
  }, [locks, t]);

  const selectedKey = useMemo(() => {
    const pathKeys: string[] = [];
    const collect = (list: readonly SidebarItem[]) => {
      for (const item of list) {
        if ("children" in item) {
          collect(item.children);
        } else if (item.key.startsWith("/")) {
          pathKeys.push(item.key);
        }
      }
    };

    collect(SIDEBAR_ITEMS);

    if (pathKeys.includes(pathname)) return pathname;

    const prefixMatch = pathKeys
      .filter((key) => pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0];

    return prefixMatch ?? pathname;
  }, [pathname]);

  return (
    <div className="app-sidebar-shell">
      <div className="app-sidebar-brand" aria-label={tApp("brand")}>
        <span className="app-sidebar-brand__mark">
          <GraduationCap aria-hidden size={20} />
        </span>
        <span>{tApp("brand")}</span>
        <strong>AI</strong>
      </div>
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
        className="app-sidebar-menu"
      />
      <div className="app-sidebar-nudge">
        <TextLike strong>{tApp("sidebarNudgeTitle")}</TextLike>
        <span>{tApp("sidebarNudgeBody")}</span>
        {planLabel ? <Tag>{planLabel}</Tag> : null}
      </div>
    </div>
  );
}
