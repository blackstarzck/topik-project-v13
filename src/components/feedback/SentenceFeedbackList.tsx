"use client";

import { Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SentenceFeedbackRow } from "@/lib/writing/types";

const { Text } = Typography;

const INITIAL_VISIBLE = 5;

type Props = {
  rows: SentenceFeedbackRow[];
  /** 첨삭 생성 실패 문장의 재분석 안내(있을 때만 노출). */
  onReanalyze?: () => void;
};

/**
 * E-02 원문 답안/첨삭 (description region 2).
 * 제약: 문장별 첨삭 5개 후 더보기, 원문은 줄바꿈 보존.
 * 예외: 첨삭 생성 실패 문장(corrected_text/comment 모두 없음)은 원문만 표시하고
 *       재분석을 제공한다.
 */
export function SentenceFeedbackList({ rows, onReanalyze }: Props) {
  const t = useTranslations("feedback.sentence");
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <Card size="small" title={t("cardTitle")}>
        <Empty description={t("emptyDescription")} />
      </Card>
    );
  }

  const visible = expanded ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - visible.length;

  return (
    <Card title={t("cardTitle")} size="small">
      <List
        dataSource={visible}
        renderItem={(r) => {
          const failed = !r.corrected_text && !r.comment;
          return (
            <List.Item key={r.id}>
              <div style={{ width: "100%" }}>
                {/* 원문은 줄바꿈 보존. */}
                {r.original_text ? (
                  <Text
                    delete={!failed}
                    type="secondary"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {r.original_text}
                  </Text>
                ) : null}
                {failed ? (
                  <div style={{ marginTop: 4 }}>
                    <Space size={8} wrap>
                      <Tag color="default">{t("failTag")}</Tag>
                      {onReanalyze ? (
                        <Button
                          size="small"
                          type="link"
                          style={{ padding: 0 }}
                          onClick={onReanalyze}
                        >
                          {t("reanalyze")}
                        </Button>
                      ) : null}
                    </Space>
                  </div>
                ) : (
                  <>
                    {r.corrected_text ? (
                      <div style={{ whiteSpace: "pre-line" }}>
                        <Text>{r.corrected_text}</Text>
                      </div>
                    ) : null}
                    {r.comment ? (
                      <div>
                        <Text type="secondary">{r.comment}</Text>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </List.Item>
          );
        }}
      />
      {hiddenCount > 0 ? (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <Button type="link" onClick={() => setExpanded(true)}>
            {t("showMore", { count: hiddenCount })}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
