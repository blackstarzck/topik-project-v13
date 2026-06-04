"use client";

import { Drawer } from "antd";
import type { DrawerProps } from "antd";

/**
 * Shared user-facing Drawer surface.
 *
 * Wraps AntD `Drawer` and adds the stable theme hook `.app-drawer` on the portal
 * root (08-theme-architecture.md "Overlay Surface Rule") so presets can style the
 * overlay surface and its first frame. AntD owns the open lifecycle, focus trap,
 * Escape-to-close (`keyboard`, default on), and mask-to-close (`maskClosable`,
 * default on); we preserve those defaults so keyboard close and focus return keep
 * working. No `--app-*` is declared here (Rule 1).
 *
 * "use client": Drawer is interactive (portal + open state + focus management).
 */
export function AppDrawer({ rootClassName, ...props }: DrawerProps) {
  return (
    <Drawer
      {...props}
      rootClassName={["app-drawer", rootClassName].filter(Boolean).join(" ")}
    />
  );
}
