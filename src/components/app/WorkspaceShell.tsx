"use client";

import { Button, Grid, Layout, Menu, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
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
  Menu as MenuIcon,
  PenLine,
  Settings,
  Target,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AppDrawer } from "@/components/shared/AppDrawer";
import type { AppRole } from "@/lib/auth/roles";
import {
  computeSidebarLocks,
  SIDEBAR_ITEMS,
  type SidebarItem,
  type SidebarLeaf,
  type SidebarLockMap,
} from "@/lib/routes";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

type Props = {
  role: AppRole;
  email?: string | null;
  /** `profiles.plan_label` is used for plan-based menu locking. */
  planLabel?: string | null;
  children: ReactNode;
};

type MenuItems = MenuProps["items"];
type MenuItem = NonNullable<MenuItems>[number];
type NavTranslate = ReturnType<typeof useTranslations<"nav">>;
type NavKey = Parameters<NavTranslate>[0];

export function WorkspaceShell({ role, email, planLabel, children }: Props) {
  const t = useTranslations("app");
  const screens = useBreakpoint();
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showDrawer = isMobile && drawerOpen;

  return (
    <Layout className="min-h-screen">
      <Sider
        breakpoint="md"
        collapsedWidth={0}
        width={240}
        trigger={null}
        className="bg-background"
      >
        <WorkspaceNav role={role} planLabel={planLabel} />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-3">
            {isMobile ? (
              <Button
                type="text"
                aria-label={t("openMenu")}
                onClick={() => setDrawerOpen(true)}
                icon={<MenuIcon aria-hidden size={20} />}
              />
            ) : null}
            <span className="text-xl font-semibold text-text">
              {t("brand")}
            </span>
          </div>
          <div>
            {email ? (
              <span className="text-text-secondary">{email}</span>
            ) : null}
          </div>
        </Header>
        <Content className="p-6">{children}</Content>
      </Layout>

      <AppDrawer
        placement="left"
        size={240}
        open={showDrawer}
        onClose={() => setDrawerOpen(false)}
        styles={{
          body: {
            padding: 0,
            display: "flex",
            minHeight: "calc(100dvh - 56px)",
          },
        }}
        title={t("menu")}
      >
        <WorkspaceNav
          role={role}
          planLabel={planLabel}
          onNavigate={() => setDrawerOpen(false)}
        />
      </AppDrawer>
    </Layout>
  );
}

function WorkspaceNav({
  role,
  planLabel,
  onNavigate,
}: {
  role: AppRole;
  planLabel?: string | null;
  onNavigate?: () => void;
}) {
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
    <div className="app-sidebar-shell h-full w-full">
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
        <strong>{tApp("sidebarNudgeTitle")}</strong>
        <span>{tApp("sidebarNudgeBody")}</span>
        {planLabel ? <Tag>{planLabel}</Tag> : null}
      </div>
    </div>
  );
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

function lockedLeafLabel(label: string, reason: string) {
  return (
    <Tooltip title={`${label} - ${reason}`} placement="right">
      <span
        className="inline-flex items-center gap-2"
        aria-label={`${label}, ${reason}`}
      >
        <Lock aria-hidden size={12} className="shrink-0 opacity-70" />
        <span>{label}</span>
        <Tag className="ms-auto text-xs leading-4">{reason}</Tag>
      </span>
    </Tooltip>
  );
}

function navIcon(key: string) {
  const props = { "aria-hidden": true, size: 17 };

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
