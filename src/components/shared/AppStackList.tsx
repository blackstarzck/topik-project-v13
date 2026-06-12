import { Children, type ReactNode } from "react";
import { Flex } from "antd";

type AppStackListProps = {
  children: ReactNode;
  className?: string;
};

type AppStackListItemProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  isLast?: boolean;
  split?: boolean;
};

export function AppStackList({ children, className }: AppStackListProps) {
  return (
    <Flex
      vertical
      role="list"
      className={["w-full", className].filter(Boolean).join(" ")}
    >
      {children}
    </Flex>
  );
}

export function AppStackListItem({
  actions,
  children,
  className,
  compact = false,
  isLast = false,
  split = true,
}: AppStackListItemProps) {
  const actionItems = Children.toArray(actions);

  return (
    <Flex
      role="listitem"
      align="flex-start"
      gap="medium"
      justify="space-between"
      wrap
      className={[
        "w-full",
        compact ? "py-1" : "py-2",
        split && !isLast ? "border-b border-border" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-[1_1_320px]">{children}</div>
      {actionItems.length > 0 ? (
        <Flex align="center" gap="small" justify="flex-end" wrap>
          {actionItems}
        </Flex>
      ) : null}
    </Flex>
  );
}
