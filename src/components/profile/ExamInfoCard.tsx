"use client";

import { Card, Empty, Tag, Typography } from "antd";
import Link from "next/link";

const { Text, Paragraph } = Typography;

type Props = {
  goal: {
    topik_level: "TOPIK_I" | "TOPIK_II";
    target_grade: number;
    exam_date: string | null;
  } | null;
};

/**
 * Phase 7-E Task 10 (P1-6) — 목표 시험 정보 카드.
 * learning_goals 데이터 재사용. 변경은 onboarding 페이지로.
 */
export function ExamInfoCard({ goal }: Props) {
  return (
    <Card title="목표 시험">
      {!goal ? (
        <Empty
          description="아직 목표를 설정하지 않았어요."
          imageStyle={{ display: "none" }}
        >
          <Link href="/onboarding/learning-goal">목표 설정하기</Link>
        </Empty>
      ) : (
        <>
          <Paragraph>
            <Tag color="blue">{goal.topik_level === "TOPIK_I" ? "TOPIK I" : "TOPIK II"}</Tag>
            <Text strong> 목표 {goal.target_grade}급</Text>
          </Paragraph>
          {goal.exam_date ? (
            <Paragraph>
              <Text>시험일: </Text>
              <Text strong>
                {new Date(goal.exam_date).toLocaleDateString("ko-KR")}
              </Text>
            </Paragraph>
          ) : (
            <Paragraph type="secondary">시험일이 설정되지 않았습니다.</Paragraph>
          )}
          <Paragraph>
            <Link href="/onboarding/learning-goal">변경하기</Link>
          </Paragraph>
        </>
      )}
    </Card>
  );
}
