import { Children, type CSSProperties, type ReactNode } from "react";
import { Flex } from "antd";

import { SPACING } from "@/theme/spacing";

type AppStackListProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type AppStackListItemProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  contentStyle?: CSSProperties;
  isLast?: boolean;
  split?: boolean;
  style?: CSSProperties;
};

export function AppStackList({ children, className, style }: AppStackListProps) {
  return (
    <Flex
      vertical
      role="list"
      className={className}
      style={{ width: "100%", ...style }}
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
  contentStyle,
  isLast = false,
  split = true,
  style,
}: AppStackListItemProps) {
  const actionItems = Children.toArray(actions);
  const paddingBlock = compact ? SPACING.xs : SPACING.sm;

  return (
    <Flex
      role="listitem"
      align="flex-start"
      gap="medium"
      justify="space-between"
      wrap
      className={className}
      style={{
        borderBlockEnd:
          split && !isLast ? "1px solid var(--app-color-border)" : undefined,
        paddingBlock,
        width: "100%",
        ...style,
      }}
    >
      <div style={{ flex: "1 1 320px", minWidth: 0, ...contentStyle }}>
        {children}
      </div>
      {actionItems.length > 0 ? (
        <Flex align="center" gap="small" justify="flex-end" wrap>
          {actionItems}
        </Flex>
      ) : null}
    </Flex>
  );
}
