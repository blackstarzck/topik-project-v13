"use client";

import { Col, Row, Tag, Tooltip, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppCard } from "@/components/shared/AppCard";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

const { Text, Title } = Typography;

type Props = {
  /**
   * 권한 등으로 잠긴 유형 집합. 잠긴 유형은 비활성 카드 + 안내 툴팁(§4 예외).
   * 현재는 모든 유형이 열려 있어 기본값은 빈 집합.
   */
  lockedTypes?: Set<QuestionNo>;
};

export function TypeSelectCards({ lockedTypes }: Props) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  return (
    <div>
      <Title level={5} style={{ marginBottom: 8 }}>
        {t("typeSelectTitle")}
      </Title>
      <Row gutter={[12, 12]}>
        {QUESTION_NOS.map((qn) => {
          const locked = lockedTypes?.has(qn) ?? false;
          const typeLabel = tCommon(`questionType${qn}`);
          const desc = t(`typeDescription${qn}`);
          const card = (
            <AppCard
              size="small"
              hoverable={!locked}
              style={locked ? { opacity: 0.55 } : undefined}
              title={
                <span>
                  {typeLabel}
                  {locked ? (
                    <Tag color="default" style={{ marginLeft: 8 }}>
                      {t("locked")}
                    </Tag>
                  ) : null}
                </span>
              }
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                {desc.length > 60 ? `${desc.slice(0, 60)}…` : desc}
              </Text>
            </AppCard>
          );
          return (
            <Col key={qn} xs={24} sm={12} lg={6}>
              {locked ? (
                // §4 예외 — 이용 불가 유형은 비활성 카드 + 안내 툴팁.
                <Tooltip title={t("typeLockedTooltip")}>
                  <div aria-disabled style={{ cursor: "not-allowed" }}>
                    {card}
                  </div>
                </Tooltip>
              ) : (
                <Link
                  href={`/writing/${qn}` as never}
                  aria-label={t("typeStartAria", { type: typeLabel })}
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
