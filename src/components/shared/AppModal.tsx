"use client";

import { Modal } from "antd";
import type { ModalProps } from "antd";
import { useLayoutEffect } from "react";

import styles from "./AppModal.module.css";

export type AppModalPlacement = "center" | "bottom-right";

export type AppModalProps = ModalProps & {
  placement?: AppModalPlacement;
  nonBlocking?: boolean;
};

/**
 * Shared user-facing Modal surface.
 *
 * Wraps AntD `Modal` and adds the stable theme hook `.app-modal` on the portal
 * root (08-theme-architecture.md "Overlay Surface Rule") so presets can style the
 * overlay surface and its first frame without forking the component. AntD owns the
 * open lifecycle, focus trap, Escape-to-close (`keyboard`, default on) and
 * mask-to-close (`maskClosable`, default on). Those defaults remain unchanged
 * unless a caller explicitly opts into the inline, non-blocking panel mode.
 * No `--app-*` is declared here (08 Rule 1: `--app-*` may only live on
 * html/:root).
 */
export function AppModal({
  placement = "center",
  nonBlocking = false,
  rootClassName,
  centered,
  getContainer,
  mask,
  focusable,
  open,
  ...props
}: AppModalProps) {
  const isCentered = placement === "center";

  useLayoutEffect(() => {
    if (!nonBlocking || !open) return;

    const syncAriaModal = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        '.app-modal--non-blocking .ant-modal[aria-modal="true"]',
      );
      dialogs.forEach((dialog) => {
        dialog.setAttribute("aria-modal", "false");
      });
      return dialogs.length > 0;
    };

    if (syncAriaModal()) return;

    const observer = new MutationObserver(() => {
      if (syncAriaModal()) observer.disconnect();
    });
    observer.observe(document.body, {
      attributeFilter: ["aria-modal"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [nonBlocking, open]);

  return (
    <Modal
      {...props}
      open={open}
      centered={isCentered ? (centered ?? true) : false}
      getContainer={nonBlocking ? false : getContainer}
      mask={nonBlocking ? false : mask}
      focusable={
        nonBlocking
          ? {
              ...focusable,
              focusTriggerAfterClose: false,
              trap: false,
            }
          : focusable
      }
      rootClassName={[
        "app-modal",
        isCentered ? "app-modal--center-origin" : "app-modal--bottom-right",
        isCentered ? null : styles.bottomRight,
        nonBlocking ? "app-modal--non-blocking" : null,
        nonBlocking ? styles.nonBlocking : null,
        rootClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
