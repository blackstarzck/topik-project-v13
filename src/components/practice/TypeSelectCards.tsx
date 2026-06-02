"use client";

import { Card, Col, Row, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";
import { TYPE_LABELS } from "./recommendations-data";

const { Text, Title } = Typography;

/** C-01 §4 유형별 선택 카드. 카드 설명 60자 이하, 카드 최대 4개. */
const TYPE_DESCRIPTIONS: Record<QuestionNo, string> = {
  51: "빈칸에 알맞은 짧은 문장을 채우는 단답형이에요.",
  52: "두 빈칸을 문맥에 맞는 한 문장으로 완성해요.",
  53: "표·그래프 자료를 200~300자 장문으로 설명해요.",
  54: "주제에 대한 600~700자 논리 에세이를 작성해요.",
};

type Props = {
  /**
   * 권한 등으로 잠긴 유형 집합. 잠긴 유형은 비활성 카드 + 안내 툴팁(§4 예외).
   * 현재는 모든 유형이 열려 있어 기본값은 빈 집합.
   */
  lockedTypes?: Set<QuestionNo>;
};

export function TypeSelectCards({ lockedTypes }: Props) {
  return (
    <div>
      <Title level={5} style={{ marginBottom: 8 }}>
        유형을 직접 골라 시작하기
      </Title>
      <Row gutter={[12, 12]}>
        {QUESTION_NOS.map((qn) => {
          const locked = lockedTypes?.has(qn) ?? false;
          const desc = TYPE_DESCRIPTIONS[qn];
          const card = (
            <Card
              size="small"
              hoverable={!locked}
              style={locked ? { opacity: 0.55 } : undefined}
              title={
                <span>
                  {TYPE_LABELS[qn]}
                  {locked ? (
                    <Tag color="default" style={{ marginLeft: 8 }}>
                      잠김
                    </Tag>
                  ) : null}
                </span>
              }
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                {desc.length > 60 ? `${desc.slice(0, 60)}…` : desc}
              </Text>
            </Card>
          );
          return (
            <Col key={qn} xs={24} sm={12} lg={6}>
              {locked ? (
                // §4 예외 — 이용 불가 유형은 비활성 카드 + 안내 툴팁.
                <Tooltip title="이 유형은 현재 이용할 수 없어요. 학습 단계가 올라가면 열려요.">
                  <div aria-disabled style={{ cursor: "not-allowed" }}>
                    {card}
                  </div>
                </Tooltip>
              ) : (
                <Link
                  href={`/writing/${qn}` as never}
                  aria-label={`${TYPE_LABELS[qn]} 시작`}
                >
                  {card}
                </Link>
              )}
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
