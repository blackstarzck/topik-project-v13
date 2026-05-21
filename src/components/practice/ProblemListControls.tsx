"use client";

import { Input, Select, Space } from "antd";
import { useEffect, useState } from "react";
import type { ProblemFilter, ProblemSort } from "@/lib/practice/types";

type Props = {
  filter: ProblemFilter;
  sort: ProblemSort;
  onFilterChange: (next: ProblemFilter) => void;
  onSortChange: (next: ProblemSort) => void;
};

export function ProblemListControls({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: Props) {
  const [searchInput, setSearchInput] = useState(filter.search ?? "");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if ((filter.search ?? "") !== searchInput) {
        onFilterChange({ ...filter, search: searchInput });
      }
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <Space wrap size="middle" style={{ width: "100%" }}>
      <Input.Search
        placeholder="제목 또는 키워드"
        allowClear
        style={{ width: 240 }}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <Select
        value={filter.difficulty ?? "any"}
        style={{ width: 140 }}
        onChange={(value) =>
          onFilterChange({
            ...filter,
            difficulty: value === "any" ? null : Number(value),
          })
        }
        options={[
          { value: "any", label: "난이도 전체" },
          ...Array.from({ length: 5 }, (_, i) => ({
            value: String(i + 1),
            label: `난이도 ${i + 1}`,
          })),
        ]}
      />
      <Select
        value={sort}
        style={{ width: 160 }}
        onChange={(value) => onSortChange(value as ProblemSort)}
        options={[
          { value: "newest", label: "최신순" },
          { value: "oldest", label: "오래된순" },
          { value: "difficulty-asc", label: "난이도 낮은순" },
          { value: "difficulty-desc", label: "난이도 높은순" },
        ]}
      />
    </Space>
  );
}
