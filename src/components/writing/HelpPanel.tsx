"use client";

import Link from "next/link";
import { Button, Empty, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type { QuestionNo } from "@/lib/writing/types";

const { Text, Paragraph } = Typography;

export type HelpCard = { title: string; body: string };

/**
 * D §5 우측 도움말 — 유형별 작성 팁(카드 3개 이하, 제목 16자, 본문 2줄).
 * 실제 도움말 콘텐츠 테이블이 아직 없어 유형별 정적 팁을 제공한다. 외부 CMS/
 * 도움말 테이블이 생기면 이 상수를 데이터 fetch 로 교체하는 seam. 문구는
 * 카탈로그(writing.help.tipsNN.*)에서 t()로 해석하므로 여기서는 유형별
 * 카드 키만 보관한다.
 */
const TIP_KEYS: Record<QuestionNo, { title: string; body: string }[]> = {
  51: [
    { title: "tips51_0Title", body: "tips51_0Body" },
    { title: "tips51_1Title", body: "tips51_1Body" },
    { title: "tips51_2Title", body: "tips51_2Body" },
  ],
  52: [
    { title: "tips52_0Title", body: "tips52_0Body" },
    { title: "tips52_1Title", body: "tips52_1Body" },
    { title: "tips52_2Title", body: "tips52_2Body" },
  ],
  53: [
    { title: "tips53_0Title", body: "tips53_0Body" },
    { title: "tips53_1Title", body: "tips53_1Body" },
    { title: "tips53_2Title", body: "tips53_2Body" },
  ],
  54: [
    { title: "tips54_0Title", body: "tips54_0Body" },
    { title: "tips54_1Title", body: "tips54_1Body" },
    { title: "tips54_2Title", body: "tips54_2Body" },
  ],
};

type Props = {
  /** 명시 카드 주입 시 그대로 사용. 미지정이면 questionNo 기본 팁. */
  cards?: HelpCard[];
  questionNo?: QuestionNo;
};

export function HelpPanel({ cards, questionNo }: Props) {
  const t = useTranslations("writing.help");
  const defaultCards: HelpCard[] | undefined =
    questionNo != null
      ? TIP_KEYS[questionNo].map((c) => ({
          title: t(c.title as never),
          body: t(c.body as never),
        }))
      : undefined;
  const resolved = cards ?? defaultCards;

  if (!resolved || resolved.length === 0) {
    // §5 예외 — 도움말 없음: 접힌 빈 상태 + 추천 링크.
    return (
      <AppCard size="small">
        <Empty description={t("empty")}>
          <Link href={"/practice/recommendations" as never}>
            <Button size="small">{t("viewRecommendations")}</Button>
          </Link>
        </Empty>
      </AppCard>
    );
  }

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {resolved.slice(0, 3).map((c, i) => (
        <AppCard key={i} size="small">
          <Text strong>{c.title.slice(0, 16)}</Text>
          <Paragraph
            style={{ margin: 0 }}
            type="secondary"
            ellipsis={{ rows: 2 }}
          >
            {c.body}
          </Paragraph>
        </AppCard>
      ))}
    </Space>
  );
}
