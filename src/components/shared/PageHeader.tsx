import type { ReactNode } from "react";

type Props = {
  /** Page/section title. Rendered as the level-1 heading. */
  title: ReactNode;
  /** Optional supporting line under the title. */
  subtitle?: ReactNode;
  /** Optional trailing actions (e.g. a primary CTA), right-aligned. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared page header (title + optional subtitle + optional actions).
 *
 * Carries NO copy of its own — every visible string comes from props, so it is
 * i18n-neutral and reusable across screens. Layout/structure lives in
 * `src/styles/global.css` (`.app-page-header*`). Plain semantic elements (no AntD
 * Typography compound) keep it server-component safe and avoid the prod React
 * #130 compound-in-RSC hazard. No `--app-*` inline declaration.
 */
export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <header
      className={["app-page-header", className].filter(Boolean).join(" ")}
    >
      <div className="app-page-header__titles">
        <h1 className="app-page-header__title">{title}</h1>
        {subtitle ? (
          <p className="app-page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="app-page-header__actions">{actions}</div>
      ) : null}
    </header>
  );
}
