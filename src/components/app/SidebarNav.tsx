"use client";

import {
  ConfigProvider,
  Menu,
  Tag,
  Tooltip,
  theme as antdTheme,
  type MenuProps,
  type ThemeConfig,
} from "antd";
import {
  BarChart3,
  Bell,
  BookOpen,
  Home,
  Languages,
  Library,
  Lightbulb,
  ListChecks,
  Lock,
  PenLine,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { AppRole } from "@/lib/auth/roles";
import {
  APP_ROUTES,
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

function matchesRoute(pathname: string, key: string) {
  return pathname === key || pathname.startsWith(`${key}/`);
}

function groupMatchesRoute(group: SidebarItem, pathname: string) {
  if (!("children" in group)) return false;

  if (group.children.some((child) => matchesRoute(pathname, child.key))) {
    return true;
  }

  if (group.key === "writing") {
    return matchesRoute(pathname, "/writing");
  }

  if (group.key === "settings") {
    return matchesRoute(pathname, "/settings");
  }

  return false;
}

function getRouteOpenKeys(pathname: string) {
  return SIDEBAR_ITEMS.filter((item) => groupMatchesRoute(item, pathname)).map(
    (item) => item.key,
  );
}

function mergeOpenKeys(openKeys: readonly string[], requiredKeys: string[]) {
  return Array.from(new Set([...openKeys, ...requiredKeys]));
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
  if (key === "growth" || key === "/growth") return <BarChart3 {...props} />;
  if (key === "/profile") return <UserRound {...props} />;
  if (key === "settings") return <Settings {...props} />;
  if (key === "/settings/learning") return <Target {...props} />;
  if (key === "/settings/account") return <ShieldCheck {...props} />;
  if (key === "/settings/language") return <Languages {...props} />;
  if (key === "/settings/notifications") return <Bell {...props} />;

  return null;
}

export function SidebarNav({ role, planLabel, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = antdTheme.useToken();
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

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getRouteOpenKeys(pathname),
  );
  const [trackedPathname, setTrackedPathname] = useState(pathname);

  // Auto-expand the active route's group only when navigation changes the path.
  // After that the user's open/close choice wins, so a selected child no longer
  // forces its accordion to stay open.
  if (trackedPathname !== pathname) {
    setTrackedPathname(pathname);
    setOpenKeys((prev) => mergeOpenKeys(prev, getRouteOpenKeys(pathname)));
  }

  const sidebarMenuTheme = useMemo<ThemeConfig>(
    () => ({
      components: {
        Menu: {
          activeBarBorderWidth: 0,
          activeBarWidth: 0,
          itemActiveBg: token.colorFillSecondary,
          itemBorderRadius: 8,
          itemHoverBg: token.colorFillTertiary,
          itemHoverColor: token.colorText,
          itemSelectedBg: token.colorPrimary,
          itemSelectedColor: token.colorWhite,
          subMenuItemBorderRadius: 8,
        },
      },
    }),
    [
      token.colorFillSecondary,
      token.colorFillTertiary,
      token.colorPrimary,
      token.colorText,
      token.colorWhite,
    ],
  );

  return (
    <div className="app-sidebar-shell">
      <button
        type="button"
        className="app-sidebar-brand"
        aria-label={tApp("brand")}
        onClick={() => {
          router.push(APP_ROUTES.dashboard);
          onNavigate?.();
        }}
      >
        <BrandLogo className="app-sidebar-brand__logo" height={68} />
      </button>
      <div className="app-sidebar-menu-scroll">
        <ConfigProvider theme={sidebarMenuTheme}>
          <Menu
            mode="inline"
            openKeys={openKeys}
            selectedKeys={[selectedKey]}
            onOpenChange={(nextOpenKeys) => {
              setOpenKeys(nextOpenKeys);
            }}
            onClick={({ key }) => {
              if (typeof key === "string" && key.startsWith("/")) {
                router.push(key);
                onNavigate?.();
              }
            }}
            items={items}
            className="app-sidebar-menu"
          />
        </ConfigProvider>
      </div>
    </div>
  );
}
