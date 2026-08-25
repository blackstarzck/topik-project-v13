"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { CardProps } from "antd";
import { AppCard } from "./AppCard";

type SelectableAppCardProps = Omit<CardProps, "onSelect"> & {
  selected?: boolean;
  disabled?: boolean;
  locked?: boolean;
  onSelect?: () => void;
};

function mergeActionsClassName(
  classNames: CardProps["classNames"],
  hasActions: boolean,
): CardProps["classNames"] {
  if (!hasActions) return classNames;

  const actionsClassName = (value?: string) =>
    ["app-card-footer-actions", value].filter(Boolean).join(" ");

  if (typeof classNames === "function") {
    return (info) => {
      const resolvedClassNames = classNames(info);
      return {
        ...resolvedClassNames,
        actions: actionsClassName(resolvedClassNames?.actions),
      };
    };
  }

  return {
    ...classNames,
    actions: actionsClassName(classNames?.actions),
  };
}

export function SelectableAppCard({
  selected = false,
  disabled = false,
  locked = false,
  onSelect,
  className,
  classNames,
  actions,
  children,
  role,
  tabIndex,
  onClick,
  onKeyDown,
  ...props
}: SelectableAppCardProps) {
  const interactive = typeof onSelect === "function";
  const unavailable = disabled || locked;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    onClick?.(event);
    if (event.defaultPrevented || unavailable) return;
    onSelect?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || unavailable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect?.();
  }

  return (
    <AppCard
      {...props}
      actions={actions}
      classNames={mergeActionsClassName(classNames, Boolean(actions?.length))}
      role={interactive ? "button" : role}
      tabIndex={interactive && !unavailable ? 0 : tabIndex}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={interactive && unavailable ? true : undefined}
      onClick={interactive ? handleClick : onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      className={[
        "selectable-app-card",
        selected ? "selectable-app-card--selected" : null,
        unavailable ? "selectable-app-card--disabled" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="selectable-app-card__content">
        {children}
      </div>
    </AppCard>
  );
}
