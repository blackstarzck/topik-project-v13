"use client";

import { Menu, type MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { ADMIN_ROLES, type AppRole } from "@/lib/auth/roles";
import { SIDEBAR_ADMIN_SECTION, SIDEBAR_ITEMS } from "@/lib/routes";

type Props = {
  role: AppRole;
};

type MenuItems = MenuProps["items"];

export function SidebarNav({ role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = ADMIN_ROLES.includes(role);

  const items = useMemo<MenuItems>(
    () =>
      (isAdmin
        ? [...SIDEBAR_ITEMS, SIDEBAR_ADMIN_SECTION]
        : SIDEBAR_ITEMS) as unknown as MenuItems,
    [isAdmin],
  );

  return (
    <Menu
      mode="inline"
      selectedKeys={[pathname]}
      onClick={({ key }) => {
        if (typeof key === "string" && key.startsWith("/")) router.push(key);
      }}
      items={items}
      style={{ height: "100%", borderInlineEnd: 0 }}
    />
  );
}
