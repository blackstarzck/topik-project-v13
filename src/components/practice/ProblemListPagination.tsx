"use client";

import { Pagination } from "antd";

type Props = {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export function ProblemListPagination({
  current,
  total,
  pageSize,
  onChange,
}: Props) {
  if (total <= pageSize) return null;
  return (
    <Pagination
      current={current}
      total={total}
      pageSize={pageSize}
      showSizeChanger={false}
      onChange={onChange}
      style={{ marginTop: 24, textAlign: "center" }}
    />
  );
}
