"use client";

import { Drawer } from "antd";
import type { DrawerProps } from "antd";
import type { CSSProperties } from "react";

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
const appDrawerBodyStyle = {
  display: "flex",
  flexDirection: "column",
  minHeight: "calc(100dvh - 56px)",
} satisfies CSSProperties;

function mergeDrawerStyles(
  styles: DrawerProps["styles"],
): DrawerProps["styles"] {
  if (typeof styles === "function") {
    return (info) => {
      const resolved = styles(info);
      return {
        ...resolved,
        body: {
          ...appDrawerBodyStyle,
          ...resolved?.body,
        },
      };
    };
  }

  return {
    ...styles,
    body: {
      ...appDrawerBodyStyle,
      ...styles?.body,
    },
  };
}

export function AppDrawer({ rootClassName, styles, ...props }: DrawerProps) {
  return (
    <Drawer
      {...props}
      styles={mergeDrawerStyles(styles)}
      rootClassName={["app-drawer", rootClassName].filter(Boolean).join(" ")}
    />
  );
}
