"use client";

import {
  App,
  Button,
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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
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
  const t = useTranslations("profile.exam");
  const tCommon = useTranslations("common");
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
      message.success(t("saveSuccess"));
    } catch (err) {
      // err.message 는 데이터 계층(saveLearningGoal, src/lib/learning)에서 온
      // 서비스 메시지이므로 그대로 노출하고, 없으면 기본 저장 실패 문구로 대체.
      message.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  // Edit mode: inline form (X-05 region 2).
  if (editable && editing) {
    return (
      <AppCard title={t("cardTitle")}>
        <Form layout="vertical" disabled={saving}>
          <Form.Item
            label={t("levelLabel")}
            required
            className="profile-exam-form-item"
          >
            <Select<TopikLevel>
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
          </Form.Item>
          <Form.Item
            label={t("targetGradeLabel")}
            required
            validateStatus={gradeError ? "error" : undefined}
            help={gradeError ?? undefined}
            className="profile-exam-form-item"
          >
            <InputNumber
              value={grade}
              min={1}
              max={6}
              className="profile-exam-control"
              onChange={(v) => {
                setGrade(typeof v === "number" ? v : 1);
                setGradeError(null);
              }}
              aria-label={t("targetGradeLabel")}
            />
          </Form.Item>
          <Form.Item
            label={t("examDateLabel")}
            className="profile-exam-form-item profile-exam-form-item--roomy"
          >
            <DatePicker
              value={examDate ? dayjs(examDate) : null}
              onChange={(d) => setExamDate(d ? d.format("YYYY-MM-DD") : null)}
              disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
              className="profile-exam-control"
              aria-label={t("examDateAriaLabel")}
            />
          </Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {tCommon("save")}
            </Button>
            <Button onClick={cancelEdit} disabled={saving}>
              {tCommon("cancel")}
            </Button>
          </Space>
        </Form>
      </AppCard>
    );
  }

  // View mode.
  return (
    <AppCard
      title={t("cardTitle")}
      extra={
        editable && view ? (
          <Button type="link" size="small" onClick={startEdit}>
            {t("editCta")}
          </Button>
        ) : null
      }
    >
      {!view ? (
        <Empty
          description={t("emptyDescription")}
          className="profile-goal-empty"
        >
          {editable ? (
            <Button type="primary" onClick={startEdit}>
              {t("setGoalCta")}
            </Button>
          ) : (
            <Link href="/onboarding/learning-goal">{t("setGoalCta")}</Link>
          )}
        </Empty>
      ) : (
        <>
          <Paragraph>
            <Tag color="blue">{topikLabel(view.topik_level)}</Tag>
            <Text strong> {t("targetGradeValue", { grade: view.target_grade })}</Text>
          </Paragraph>
          {view.exam_date ? (
            <Paragraph>
              <Text>{t("examDatePrefix")}</Text>
              <Text strong>
                {new Date(view.exam_date).toLocaleDateString("ko-KR")}
              </Text>
            </Paragraph>
          ) : (
            <Paragraph type="secondary">{t("examDateUnset")}</Paragraph>
          )}
          <Paragraph className="profile-flush-copy">
            <Link href="/onboarding/learning-goal">
              {t("moreSettingsLink")}
            </Link>
          </Paragraph>
        </>
      )}
    </AppCard>
  );
}
