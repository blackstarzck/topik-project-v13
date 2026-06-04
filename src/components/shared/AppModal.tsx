"use client";

import { Modal } from "antd";
import type { ModalProps } from "antd";

/**
 * Shared user-facing Modal surface.
 *
 * Wraps AntD `Modal` and adds the stable theme hook `.app-modal` on the portal
 * root (08-theme-architecture.md "Overlay Surface Rule") so presets can style the
 * overlay surface and its first frame without forking the component. AntD owns the
 * open lifecycle, focus trap, Escape-to-close (`keyboard`, default on) and
 * mask-to-close (`maskClosable`, default on); we preserve those defaults so
 * keyboard close and focus return keep working. No `--app-*` is declared here
 * (08 Rule 1: `--app-*` may only live on html/:root).
 *
 * Introduced in the first modal cluster (practice RetryModal) per PLAN.md §공통
 * 규칙 / 확장 로드맵. "use client": Modal is interactive (portal + open state +
 * focus management).
 */
export function AppModal({ rootClassName, ...props }: ModalProps) {
  return (
    <Modal
      {...props}
      rootClassName={["app-modal", rootClassName].filter(Boolean).join(" ")}
    />
  );
}
