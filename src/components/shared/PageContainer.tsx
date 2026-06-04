import type { ReactNode } from "react";

type PageContainerSize = "narrow" | "default" | "wide";

type Props = {
  children: ReactNode;
  /** Max-width bound. narrow = auth/forms, default = app pages, wide = data. */
  size?: PageContainerSize;
  className?: string;
  /** Accessible name for the main landmark when the page lacks a visible h1. */
  "aria-label"?: string;
};

/**
 * Shared page content container.
 *
 * Renders the single `<main>` landmark with consistent max-width + centering
 * (sizing lives in `src/styles/global.css` via `.app-page-container*`). Replaces
 * the per-screen ad-hoc `<main style={{ maxWidth, margin }}>` blocks. Layout-only
 * primitive — no AntD compound import, so it is server-component safe and carries
 * no `--app-*` inline declaration.
 */
export function PageContainer({
  children,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <main
      aria-label={ariaLabel}
      className={[
        "app-page-container",
        `app-page-container--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </main>
  );
}
