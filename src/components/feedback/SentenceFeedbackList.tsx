"use client";

import { Card, Empty, List, Typography } from "antd";
import type { SentenceFeedbackRow } from "@/lib/writing/types";

const { Text } = Typography;

type Props = { rows: SentenceFeedbackRow[] };

export function SentenceFeedbackList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <Card size="small">
        <Empty description="문장별 첨삭이 없습니다." />
      </Card>
    );
  }
  return (
    <Card title="문장별 첨삭" size="small">
      <List
        dataSource={rows}
        renderItem={(r) => (
          <List.Item key={r.id}>
            <div style={{ width: "100%" }}>
              {r.original_text ? (
                <Text delete type="secondary">
                  {r.original_text}
                </Text>
              ) : null}
              {r.corrected_text ? (
                <div>
                  <Text>{r.corrected_text}</Text>
                </div>
              ) : null}
              {r.comment ? (
                <div>
                  <Text type="secondary">{r.comment}</Text>
                </div>
              ) : null}
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
