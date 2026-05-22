"use client";

import { Select, Space, Spin } from "antd";
import { useToggleProblemPublish } from "@/lib/admin/mutations";
import {
  PUBLISH_STATUS_OPTIONS,
  type AdminProblemRow,
} from "@/lib/admin/types";

type PublishStatus = AdminProblemRow["publish_status"];

const STATUS_LABEL: Record<PublishStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

type Props = {
  row: AdminProblemRow;
};

export function AdminProblemPublishToggle({ row }: Props) {
  const mutation = useToggleProblemPublish();

  function handleChange(nextStatus: PublishStatus) {
    if (nextStatus === row.publish_status) return;
    mutation.mutate({ problemId: row.id, newStatus: nextStatus });
  }

  return (
    <Space size="small" align="center">
      <Select<PublishStatus>
        aria-label="공개 상태 변경"
        value={row.publish_status}
        style={{ width: 110 }}
        disabled={mutation.isPending}
        onChange={handleChange}
        options={PUBLISH_STATUS_OPTIONS.map((s) => ({
          value: s,
          label: STATUS_LABEL[s],
        }))}
      />
      {mutation.isPending ? <Spin size="small" /> : null}
    </Space>
  );
}
