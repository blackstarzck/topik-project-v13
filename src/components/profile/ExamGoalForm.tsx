"use client";

import {
  App,
  Button,
  DatePicker,
  Form,
  InputNumber,
  Select,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { saveLearningGoal } from "@/lib/learning/mutations";

const { Text } = Typography;

/**
 * 좌측 label / 우측 control 가로 배치 행. X-09 알림 설정의 SettingRow와 동일한
 * `.settings-field-row*` 스타일(= `.notification-settings-row*`와 공유)을 재사용한다.
 * control은 aria-label로 접근성 이름을 가지므로 label은 시각용 span으로 둔다.
 */
function FieldRow({
  label,
  error,
  testId,
  children,
}: {
  label: ReactNode;
  error?: ReactNode;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-field-row" data-testid={testId}>
      <div className="settings-field-row-label">
        <span>{label}</span>
      </div>
      <div className="settings-field-row-control">
        {children}
        {error ? (
          <Text type="danger" role="alert">
            {error}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

type TopikLevel = "TOPIK_I" | "TOPIK_II";

export type ExamGoal = {
  topik_level: TopikLevel;
  target_grade: number;
  exam_date: string | null;
  /** Preserved across saves so we don't clobber other goal fields. */
  weekly_goal_minutes?: number | null;
  weak_areas?: string[];
};

type Props = {
  /**
   * Authenticated user id. `saveLearningGoal` upserts the owner-scoped
   * learning_goals row (RLS enforces `user_id = auth.uid()`). When absent the
   * form stays read-only (저장 비활성화).
   */
  userId?: string;
  goal: ExamGoal | null;
};

// TOPIK 등급별 지원 목표 급수. LearningGoalForm과 동일한 규칙을 공유한다.
const SUPPORTED_GRADES: Record<TopikLevel, readonly number[]> = {
  TOPIK_I: [1, 2],
  TOPIK_II: [3, 4, 5, 6],
};

/**
 * X-05 region 2 — 목표 시험 정보(TOPIK 등급/목표 등급/시험일)를 학습 목표 설정
 * 화면에서 바로 편집한다. 별도 보기 단계나 카드 래퍼 없이 폼이 기본 노출되며,
 * learning_goals upsert로 weekly_goal_minutes·weak_areas·is_active 같은 다른
 * 목표 필드는 보존한다. userId가 없으면 읽기 전용으로 동작(기존 호출부 호환).
 */
export function ExamGoalForm({ userId, goal }: Props) {
  const { message } = App.useApp();
  const t = useTranslations("profile.exam");
  const tCommon = useTranslations("common");
  const editable = Boolean(userId);

  // 마지막으로 저장된 스냅샷. 취소(되돌리기)와, 폼이 편집하지 않는 목표 필드
  // (weekly_goal_minutes·weak_areas) 보존에 사용한다.
  const [saved, setSaved] = useState<ExamGoal | null>(goal);
  const [saving, setSaving] = useState(false);

  // 폼 입력 상태.
  const [level, setLevel] = useState<TopikLevel>(saved?.topik_level ?? "TOPIK_II");
  const [grade, setGrade] = useState<number>(saved?.target_grade ?? 4);
  const [examDate, setExamDate] = useState<string | null>(saved?.exam_date ?? null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  function resetToSaved() {
    setLevel(saved?.topik_level ?? "TOPIK_II");
    setGrade(saved?.target_grade ?? 4);
    setExamDate(saved?.exam_date ?? null);
    setGradeError(null);
  }

  async function handleSave() {
    if (!userId) return;
    // 미지원 급수 검증 (Area 3 예외 규칙 재사용).
    const supported = SUPPORTED_GRADES[level];
    if (!supported.includes(grade)) {
      // ICU 리프로 등급 범위를 만들어 다시 ICU 메시지에 주입한다(문자열 연결 금지).
      const range = t("gradeRange", {
        from: supported[0],
        to: supported[supported.length - 1],
      });
      setGradeError(t("gradeUnsupported", { range }));
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
        weekly_goal_minutes: saved?.weekly_goal_minutes ?? null,
        weak_areas: saved?.weak_areas ?? [],
        is_active: true,
      });
      setSaved({
        topik_level: level,
        target_grade: grade,
        exam_date: examDate,
        weekly_goal_minutes: saved?.weekly_goal_minutes ?? null,
        weak_areas: saved?.weak_areas ?? [],
      });
      message.success(t("saveSuccess"));
    } catch (err) {
      // err.message 는 데이터 계층(saveLearningGoal, src/lib/learning)에서 온
      // 서비스 메시지이므로 그대로 노출하고, 없으면 기본 저장 실패 문구로 대체.
      message.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form disabled={saving}>
      <FieldRow label={t("levelLabel")} testId="exam-goal-row-level">
        <Select<TopikLevel>
          className="w-full"
          value={level}
          onChange={(v) => {
            setLevel(v);
            setGradeError(null);
          }}
          options={[
            { value: "TOPIK_I", label: t("levelOptionI") },
            { value: "TOPIK_II", label: t("levelOptionII") },
          ]}
          aria-label={t("levelLabel")}
        />
      </FieldRow>
      <FieldRow
        label={t("targetGradeLabel")}
        error={gradeError}
        testId="exam-goal-row-grade"
      >
        <InputNumber
          value={grade}
          min={1}
          max={6}
          status={gradeError ? "error" : undefined}
          onChange={(v) => {
            setGrade(typeof v === "number" ? v : 1);
            setGradeError(null);
          }}
          aria-label={t("targetGradeLabel")}
        />
      </FieldRow>
      <FieldRow label={t("examDateLabel")} testId="exam-goal-row-date">
        <DatePicker
          className="w-full"
          value={examDate ? dayjs(examDate) : null}
          onChange={(d) => setExamDate(d ? d.format("YYYY-MM-DD") : null)}
          disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
          aria-label={t("examDateAriaLabel")}
        />
      </FieldRow>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="primary"
          loading={saving}
          onClick={handleSave}
          disabled={!editable}
        >
          {tCommon("save")}
        </Button>
        <Button onClick={resetToSaved} disabled={saving}>
          {tCommon("cancel")}
        </Button>
      </div>
    </Form>
  );
}
