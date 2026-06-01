"use client";

import { useEffect, useState } from "react";
import { Card, Steps, Typography } from "antd";

import { AnalysisCharacter } from "./AnalysisCharacter";

const { Paragraph, Text } = Typography;

const STEPS = [
  { title: "제출 접수", description: "답안이 서버에 도착했습니다." },
  { title: "문법 분석", description: "문법 패턴과 어미 사용을 확인 중." },
  { title: "구조 분석", description: "문단 구성과 흐름을 확인 중." },
  { title: "점수 산출", description: "차원별 점수를 계산 중." },
];

type Props = {
  /** 표시할지 여부 — feedback_status === 'pending' / 'analyzing' 시 true */
  open: boolean;
};

/**
 * Phase 7-D Task 8 (P1-4) — D-M2 AI 분석 로딩 모달.
 *
 * IA spec(docs/Wireframe/13-D-M2-ai-analysis-loading/description.md): 캐릭터 + 단계
 * 인디케이터 + 메시지. 실 LLM은 Tier 2 OOS-1; 본 컴포넌트는 fixture timer로
 * step 시뮬레이션. 실제 LLM 통합 후엔 server-pushed step을 받게 교체 가능.
 */
export function AnalysisLoadingModal({ open }: Props) {
  if (!open) return null;

  return <AnalysisLoadingModalContent />;
}

function AnalysisLoadingModalContent() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card style={{ maxWidth: 480, margin: "0 auto" }}>
      <AnalysisCharacter step={step} />
      <Steps
        size="small"
        current={step}
        direction="vertical"
        items={STEPS.map((s) => ({ title: s.title, description: s.description }))}
        style={{ marginTop: 16 }}
      />
      <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
        <Text type="secondary">
          분석이 끝나면 자동으로 결과 화면으로 이동합니다.
        </Text>
      </Paragraph>
    </Card>
  );
}
