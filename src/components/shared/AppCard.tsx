import { Card } from "antd";
import type { CardProps } from "antd";

/**
 * Shared user-facing Card surface.
 *
 * Wraps AntD `Card` and adds the stable theme hooks `.app-card` / `.app-surface`
 * (08-theme-architecture.md "Overlay Surface Rule") so theme presets can style
 * the surface without forking the component. Tokens decide the material; this
 * wrapper only provides the hook. No `--app-*` is declared here (Rule 1).
 *
 * Not a client component: like AntD `Card` itself, it can render inside a server
 * component (e.g. the dashboard) or a client tree. No compound destructuring.
 */
export function AppCard({ className, ...props }: CardProps) {
  return (
    <Card
      {...props}
      className={["app-card", "app-surface", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
