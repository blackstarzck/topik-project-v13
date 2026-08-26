"use client";

import { Collapse, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { Plus } from "@/components/shared/AppIcons";

const { Text } = Typography;

export type WritingGuideAccordionItem = {
  key: string;
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  disabledOnLoadFailed?: boolean;
  className?: string;
};

type Props = {
  items: WritingGuideAccordionItem[];
  defaultActiveKeys: string[];
  loadFailed: boolean;
  loadFailedLabel: ReactNode;
  className?: string;
};

export function WritingGuideAccordion({
  items,
  defaultActiveKeys,
  loadFailed,
  loadFailedLabel,
  className = "writing-guide-accordion",
}: Props) {
  const activeKeys = loadFailed
    ? defaultActiveKeys.filter((key) => {
        const item = items.find((candidate) => candidate.key === key);
        return !item?.disabledOnLoadFailed;
      })
    : defaultActiveKeys;

  return (
    <Collapse
      className={className}
      bordered={false}
      defaultActiveKey={activeKeys}
      expandIconPlacement="end"
      expandIcon={({ isActive }) => (
        <Plus
          aria-hidden
          size={16}
          className={[
            "writing-guide-accordion__expand-icon",
            isActive ? "writing-guide-accordion__expand-icon--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      )}
      items={items.map((item) => {
        const disabled = loadFailed && Boolean(item.disabledOnLoadFailed);

        return {
          key: item.key,
          className: item.className,
          collapsible: disabled ? ("disabled" as const) : undefined,
          showArrow: disabled ? false : undefined,
          label: (
            <div className="writing-guide-card__title">
              {item.icon}
              <Text strong>{item.title}</Text>
              {disabled ? (
                <Tag className="writing-guide-card__status">
                  {loadFailedLabel}
                </Tag>
              ) : null}
            </div>
          ),
          children: disabled ? null : item.children,
        };
      })}
    />
  );
}
