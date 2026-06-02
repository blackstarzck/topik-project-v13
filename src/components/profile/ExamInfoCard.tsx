"use client";

import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";

import { saveLearningGoal } from "@/lib/learning/mutations";

const { Text, Paragraph } = Typography;

type TopikLevel = "TOPIK_I" | "TOPIK_II";

export type ExamGoal = {
  topik_level: TopikLevel;
  target_grade: number;
  exam_date: string | null;
  /** Preserved across inline saves so we don't clobber other goal fields. */
  weekly_goal_minutes?: number | null;
  weak_areas?: string[];
};

type Props = {
  /**
   * Authenticated user id. `saveLearningGoal` upserts the owner-scoped
   * learning_goals row (RLS enforces `user_id = auth.uid()`); the profile
   * page passes the resolved id down. Optional so existing view-only callers
   * keep compiling — when absent the card stays read-only (link-out only).
   */
  userId?: string;
  goal: ExamGoal | null;
};

// TOPIK 등급별 지원 목표 급수. LearningGoalForm과 동일한 규칙을 공유한다.
const SUPPORTED_GRADES: Record<TopikLevel, readonly number[]> = {
  TOPIK_I: [1, 2],
  TOPIK_II: [3, 4, 5, 6],
};

function topikLabel(level: TopikLevel): string {
  return level === "TOPIK_I" ? "TOPIK I" : "TOPIK II";
}

/**
 * X-05 region 2 — 목표 시험 정보(목표 등급/시험일)를 프로필 화면에서 바로
 * 인라인 편집한다. learning_goals를 재사용하며, userId가 없으면 읽기 전용으로
 * 동작(기존 호출부 호환). 저장은 saveLearningGoal upsert로 weekly_goal_minutes·
 * weak_areas·is_active 같은 다른 목표 필드를 보존한다.
 */
export function ExamInfoCard({ userId, goal }: Props) {
  const { message } = App.useApp();
  const editable = Boolean(userId);

  const [view, setView] = useState<ExamGoal | null>(goal);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline form draft.
  const [level, setLevel] = useState<TopikLevel>(view?.topik_level ?? "TOPIK_II");
  const [grade, setGrade] = useState<number>(view?.target_grade ?? 4);
  const [examDate, setExamDate] = useState<string | null>(
    view?.exam_date ?? null,
  );
  const [gradeError, setGradeError] = useState<string | null>(null);

  function startEdit() {
    setLevel(view?.topik_level ?? "TOPIK_II");
    setGrade(view?.target_grade ?? 4);
    setExamDate(view?.exam_date ?? null);
    setGradeError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setGradeError(null);
  }

  async function handleSave() {
    if (!userId) return;
    // 미지원 급수 검증 (Area 3 예외 규칙 재사용).
    const supported = SUPPORTED_GRADES[level];
    if (!supported.includes(grade)) {
      const range = `${supported[0]}-${supported[supported.length - 1]}급`;
      setGradeError(`선택한 등급에서는 ${range}만 지원해요.`);
      return;
    }
    setGradeError(null);
    setSaving(true);
    try {
      await saveLearningGoal({
        user_id: userId,
        topik_level: level,
        target_grade: grade,
        exam_date: examDate,
        // 다른 목표 필드는 그대로 보존 (upsert가 전체 행을 덮어쓰므로 명시).
        weekly_goal_minutes: view?.weekly_goal_minutes ?? null,
        weak_areas: view?.weak_areas ?? [],
        is_active: true,
      });
      setView({
        topik_level: level,
        target_grade: grade,
        exam_date: examDate,
        weekly_goal_minutes: view?.weekly_goal_minutes ?? null,
        weak_areas: view?.weak_areas ?? [],
      });
      setEditing(false);
      message.success("목표 시험 정보를 저장했어요.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "목표 저장에 실패했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Edit mode: inline form (X-05 region 2).
  if (editable && editing) {
    return (
      <Card title="목표 시험">
        <Form layout="vertical" disabled={saving}>
          <Form.Item label="TOPIK 등급" required style={{ marginBottom: 12 }}>
            <Select<TopikLevel>
              value={level}
              onChange={(v) => {
                setLevel(v);
                setGradeError(null);
              }}
              options={[
                { value: "TOPIK_I", label: "TOPIK I (1-2급)" },
                { value: "TOPIK_II", label: "TOPIK II (3-6급)" },
              ]}
              aria-label="TOPIK 등급"
            />
          </Form.Item>
          <Form.Item
            label="목표 등급"
            required
            validateStatus={gradeError ? "error" : undefined}
            help={gradeError ?? undefined}
            style={{ marginBottom: 12 }}
          >
            <InputNumber
              value={grade}
              min={1}
              max={6}
              style={{ width: "100%" }}
              onChange={(v) => {
                setGrade(typeof v === "number" ? v : 1);
                setGradeError(null);
              }}
              aria-label="목표 등급"
            />
          </Form.Item>
          <Form.Item label="시험 일정 (선택)" style={{ marginBottom: 16 }}>
            <DatePicker
              value={examDate ? dayjs(examDate) : null}
              onChange={(d) => setExamDate(d ? d.format("YYYY-MM-DD") : null)}
              disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
              style={{ width: "100%" }}
              aria-label="시험 일정"
            />
          </Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={handleSave}>
              저장
            </Button>
            <Button onClick={cancelEdit} disabled={saving}>
              취소
            </Button>
          </Space>
        </Form>
      </Card>
    );
  }

  // View mode.
  return (
    <Card
      title="목표 시험"
      extra={
        editable && view ? (
          <Button type="link" size="small" onClick={startEdit}>
            수정
          </Button>
        ) : null
      }
    >
      {!view ? (
        <Empty
          description="아직 목표를 설정하지 않았어요."
          imageStyle={{ display: "none" }}
        >
          {editable ? (
            <Button type="primary" onClick={startEdit}>
              목표 설정하기
            </Button>
          ) : (
            <Link href="/onboarding/learning-goal">목표 설정하기</Link>
          )}
        </Empty>
      ) : (
        <>
          <Paragraph>
            <Tag color="blue">{topikLabel(view.topik_level)}</Tag>
            <Text strong> 목표 {view.target_grade}급</Text>
          </Paragraph>
          {view.exam_date ? (
            <Paragraph>
              <Text>시험일: </Text>
              <Text strong>
                {new Date(view.exam_date).toLocaleDateString("ko-KR")}
              </Text>
            </Paragraph>
          ) : (
            <Paragraph type="secondary">시험일이 설정되지 않았습니다.</Paragraph>
          )}
          <Paragraph style={{ marginBottom: 0 }}>
            <Link href="/onboarding/learning-goal">
              주당 학습 시간·취약 영역까지 변경하기
            </Link>
          </Paragraph>
        </>
      )}
    </Card>
  );
}
