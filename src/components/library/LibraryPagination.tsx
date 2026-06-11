"use client";

import { Pagination, Space } from "antd";
import { useTranslations } from "next-intl";

export const LIBRARY_PAGE_SIZE = 10;

type Props = {
  current: number;
  total: number;
  onChange: (page: number) => void;
};

export function LibraryPagination({ current, total, onChange }: Props) {
  const t = useTranslations("library.submissions");

  return (
    <Space className="library-pagination" data-testid="library-pagination">
      <Pagination
        current={current}
        pageSize={LIBRARY_PAGE_SIZE}
        total={total}
        showLessItems
        showSizeChanger={false}
        showTotal={(count) => t("totalCount", { count })}
        onChange={onChange}
        responsive
      />
    </Space>
  );
}
