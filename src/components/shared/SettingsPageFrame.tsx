import type { ReactNode } from "react";

import { WorkspaceBody } from "@/components/app/WorkspaceBody";

import styles from "./SettingsPageFrame.module.css";

export function SettingsPageFrame({ children }: { children: ReactNode }) {
  return (
    <WorkspaceBody>
      <div className={styles.frame}>{children}</div>
    </WorkspaceBody>
  );
}
