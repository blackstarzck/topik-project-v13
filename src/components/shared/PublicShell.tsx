import type { ReactNode } from "react";

import { AffiliationCodeCapture } from "@/components/auth/AffiliationCodeCapture";

type Props = {
  children: ReactNode;
  /** Optional public chrome (e.g. a brand header) rendered above the content. */
  header?: ReactNode;
  className?: string;
};

/**
 * Shared shell for public (pre-auth) screens — landing, login, terms, etc.
 *
 * The post-login counterpart of `WorkspaceShell`. Provides consistent page
 * background + min-height + an optional header region so public screens stop
 * being styled ad-hoc (PLAN context #2 / #12). The `<main>` landmark + sizing is
 * delegated to `PageContainer` placed in `children`, so this shell never renders
 * a second `<main>`. Layout-only primitive: server-component safe, no `--app-*`
 * inline declaration (background comes from `.app-public-shell` in global.css).
 */
export function PublicShell({ children, header, className }: Props) {
  return (
    <div className={["app-public-shell", className].filter(Boolean).join(" ")}>
      <AffiliationCodeCapture />
      {header ? <div className="app-public-shell__header">{header}</div> : null}
      {children}
    </div>
  );
}
