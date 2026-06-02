"use client";

import Link from "next/link";
import { Button, Card, Empty, Space, Typography } from "antd";
import type { QuestionNo } from "@/lib/writing/types";

const { Text, Paragraph } = Typography;

export type HelpCard = { title: string; body: string };

/**
 * D §5 우측 도움말 — 유형별 작성 팁(카드 3개 이하, 제목 16자, 본문 2줄).
 * 실제 도움말 콘텐츠 테이블이 아직 없어 유형별 정적 팁을 제공한다. 외부 CMS/
 * 도움말 테이블이 생기면 이 상수를 데이터 fetch 로 교체하는 seam.
 */
const DEFAULT_TIPS: Record<QuestionNo, HelpCard[]> = {
  51: [
    { title: "빈칸 호응", body: "앞뒤 문장과 자연스럽게 이어지는 한 문장을 만드세요." },
    { title: "격식 일치", body: "지문이 격식체면 답안도 -습니다/-ㅂ니다로 맞추세요." },
    { title: "군더더기 X", body: "불필요한 수식어 없이 핵심만 간결하게 쓰세요." },
  ],
  52: [
    { title: "두 빈칸 연결", body: "두 빈칸이 한 흐름이 되도록 접속 표현을 맞추세요." },
    { title: "문장 호응", body: "주어와 서술어, 시제가 어긋나지 않게 점검하세요." },
    { title: "지시어 주의", body: "이/그/저 같은 지시어가 가리키는 대상을 분명히 하세요." },
  ],
  53: [
    { title: "자료 반영", body: "그래프·표의 수치 변화를 근거로 직접 인용하세요." },
    { title: "문단 구성", body: "도입-전개-마무리 3단 구조로 나눠 작성하세요." },
    { title: "분량 관리", body: "200~300자 안에서 핵심만 담아 마무리하세요." },
  ],
  54: [
    { title: "입장 명확", body: "서론에서 본인 입장을 분명하게 밝히세요." },
    { title: "근거 2개+", body: "본론은 서로 다른 근거 2개 이상으로 뒷받침하세요." },
    { title: "연결 표현", body: "그러나·따라서·또한으로 문단을 매끄럽게 이으세요." },
  ],
};

type Props = {
  /** 명시 카드 주입 시 그대로 사용. 미지정이면 questionNo 기본 팁. */
  cards?: HelpCard[];
  questionNo?: QuestionNo;
};

export function HelpPanel({ cards, questionNo }: Props) {
  const resolved =
    cards ?? (questionNo != null ? DEFAULT_TIPS[questionNo] : undefined);

  if (!resolved || resolved.length === 0) {
    // §5 예외 — 도움말 없음: 접힌 빈 상태 + 추천 링크.
    return (
      <Card size="small">
        <Empty description="이 유형의 작성 팁이 아직 없어요.">
          <Link href={"/practice/recommendations" as never}>
            <Button size="small">추천 문제 보기</Button>
          </Link>
        </Empty>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {resolved.slice(0, 3).map((c, i) => (
        <Card key={i} size="small">
          <Text strong>{c.title.slice(0, 16)}</Text>
          <Paragraph
            style={{ margin: 0 }}
            type="secondary"
            ellipsis={{ rows: 2 }}
          >
            {c.body}
          </Paragraph>
        </Card>
      ))}
    </Space>
  );
}
