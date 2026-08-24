import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type WorkspaceBodySize = "form" | "task" | "workspace" | "wide" | "full";

type WorkspaceBodyProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode;
  "data-testid"?: string;
  size?: WorkspaceBodySize;
};

type WorkspaceFixedActionBarProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  children: ReactNode;
  innerClassName?: string;
  size?: WorkspaceBodySize;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkspaceBody({
  children,
  className,
  size = "workspace",
  "data-testid": dataTestId = "workspace-page-body",
  ...props
}: WorkspaceBodyProps) {
  return (
    <div
      {...props}
      data-testid={dataTestId}
      data-workspace-body-size={size}
      className={classNames(
        "app-workspace-body",
        "app-workspace-body--page",
        `app-workspace-body--${size}`,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceFixedActionBar({
  children,
  className,
  innerClassName,
  size = "workspace",
  ...props
}: WorkspaceFixedActionBarProps) {
  return (
    <div
      {...props}
      className={classNames("app-workspace-fixed-action-bar", className)}
    >
      <div
        data-workspace-body-size={size}
        className={classNames(
          "app-workspace-fixed-action-bar__inner",
          "app-workspace-body",
          `app-workspace-body--${size}`,
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
