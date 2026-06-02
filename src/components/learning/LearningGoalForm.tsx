"use client";

import {
  App,
  Button,
  DatePicker,
  Form,
  InputNumber,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSaveLearningGoal } from "@/lib/learning/mutations";
import type { Tables } from "@/lib/supabase/types";

const { Title, Paragraph } = Typography;

// 취약 영역 value 는 데이터 키(불변), 라벨 문구는 onboarding.goalForm.weakAreas.*
// 카탈로그에서 t()로 해석한다(컴포넌트가 아닌 module scope 라 키만 보관).
const WEAK_AREA_VALUES = [
  "vocabulary",
  "grammar",
  "reading-comprehension",
  "listening-comprehension",
  "essay-thesis",
  "essay-structure",
  "short-answer",
  "long-form-cohesion",
] as const;

// exam_date refine 가 내보내는 안정적 에러 키. zod 는 module scope 라 t()를 쓸 수
// 없으므로 키만 내보내고, 렌더 시 onboarding.goalForm.errors.* 로 해석한다.
const EXAM_DATE_PAST_ERROR = "examDatePast";

// TOPIK 등급별로 실제 지원하는 목표 급수 범위. 이 범위를 벗어나면
// "미지원 급수"로 보고 해당 항목 하단에 안내한다 (Area 3 예외).
const SUPPORTED_GRADES: Record<FormValues["topik_level"], readonly number[]> = {
  TOPIK_I: [1, 2],
  TOPIK_II: [3, 4, 5, 6],
};

const schema = z.object({
  topik_level: z.enum(["TOPIK_I", "TOPIK_II"]),
  target_grade: z.number().int().min(1).max(6),
  exam_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => !v || !dayjs(v).startOf("day").isBefore(dayjs().startOf("day")),
      EXAM_DATE_PAST_ERROR,
    ),
  weekly_goal_minutes: z.number().int().min(15).max(2000).optional().nullable(),
  weak_areas: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

// 항목 하단에 노출할 수 있는 필드 키. `__save`는 저장 실패를 마지막 항목
// 하단(다음 CTA 위)에 안내하기 위한 가상 키다.
type FieldErrorKey = keyof FormValues | "__save";
type FieldErrors = Partial<Record<FieldErrorKey, string>>;

type Props = {
  userId: string;
  defaultValues?: Partial<Tables<"learning_goals">> | null;
};

export function LearningGoalForm({ userId, defaultValues }: Props) {
  const t = useTranslations("onboarding.goalForm");
  const router = useRouter();
  const { notification } = App.useApp();
  const mutation = useSaveLearningGoal();

  // value 는 데이터 키 고정, 라벨만 카탈로그에서 해석한다. 동적 키라 캐스트 필요.
  const weakAreaOptions = WEAK_AREA_VALUES.map((value) => ({
    value,
    label: t(`weakAreas.${value}` as Parameters<typeof t>[0]),
  }));

  // zod 가 내보낸 에러 메시지를 항목 하단 문구로 변환한다. 우리가 내보낸 안정적
  // 키(EXAM_DATE_PAST_ERROR)는 onboarding.goalForm.errors.* 로 해석하고, 그 외
  // zod 기본 메시지는 일반 형식 오류 문구로 대체한다.
  const resolveIssueMessage = (message: string) =>
    message === EXAM_DATE_PAST_ERROR
      ? t("errors.examDatePast")
      : t("errors.invalidField");

  // Area 3 예외(미지원 급수 / 저장 실패 등)는 글로벌 알림이 아니라 해당 항목
  // 하단에 인라인으로 안내한다. 성공 안내만 글로벌 알림을 유지한다.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      topik_level: defaultValues?.topik_level ?? "TOPIK_II",
      target_grade: defaultValues?.target_grade ?? 4,
      exam_date: defaultValues?.exam_date ?? null,
      weekly_goal_minutes: defaultValues?.weekly_goal_minutes ?? 240,
      weak_areas: defaultValues?.weak_areas ?? [],
    },
  });

  const clearFieldError = (key: FieldErrorKey) => {
    setFieldErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    const nextErrors: FieldErrors = {};

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      // zod 이슈를 첫 발생 필드 기준으로 항목 하단 메시지로 매핑한다.
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path !== "string") continue;
        const key = path as FieldErrorKey;
        if (nextErrors[key] === undefined) {
          nextErrors[key] = resolveIssueMessage(issue.message);
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    // 미지원 급수: 선택한 TOPIK 등급이 지원하지 않는 목표 급수면 저장하지 않고
    // 목표 등급 항목 하단에 안내한다.
    const supported = SUPPORTED_GRADES[parsed.data.topik_level];
    if (!supported.includes(parsed.data.target_grade)) {
      setFieldErrors({
        target_grade: t("errors.unsupportedGrade", {
          min: supported[0],
          max: supported[supported.length - 1],
        }),
      });
      return;
    }

    setFieldErrors({});
    try {
      await mutation.mutateAsync({
        user_id: userId,
        topik_level: parsed.data.topik_level,
        target_grade: parsed.data.target_grade,
        exam_date: parsed.data.exam_date ?? null,
        weekly_goal_minutes: parsed.data.weekly_goal_minutes ?? null,
        weak_areas: parsed.data.weak_areas,
        is_active: true,
      });
      notification.success({ message: t("saveSuccess") });
      router.push("/dashboard");
    } catch (err) {
      // 저장 실패는 현재 화면을 유지하고 항목 하단에 재시도 안내를 남긴다.
      setFieldErrors({
        __save:
          err instanceof Error
            ? t("errors.saveFailedDetail", { detail: err.message })
            : t("errors.saveFailed"),
      });
    }
  });

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {t("heading")}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t("subheading")}
        </Paragraph>
      </div>

      <Form layout="vertical" onFinish={onSubmit} disabled={mutation.isPending}>
        <Controller
          control={control}
          name="topik_level"
          render={({ field }) => (
            <Form.Item
              label={t("topikLevelLabel")}
              required
              validateStatus={fieldErrors.topik_level ? "error" : undefined}
              help={fieldErrors.topik_level}
            >
              <Select
                {...field}
                onChange={(value) => {
                  field.onChange(value);
                  // 등급을 바꾸면 미지원 급수 안내가 더는 맞지 않을 수 있으니
                  // 목표 급수 항목 하단 안내를 초기화한다.
                  clearFieldError("topik_level");
                  clearFieldError("target_grade");
                }}
                options={[
                  { value: "TOPIK_I", label: t("topikLevelOptionI") },
                  { value: "TOPIK_II", label: t("topikLevelOptionII") },
                ]}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="target_grade"
          render={({ field }) => (
            <Form.Item
              label={t("targetGradeLabel")}
              required
              validateStatus={fieldErrors.target_grade ? "error" : undefined}
              help={fieldErrors.target_grade}
            >
              <InputNumber
                {...field}
                min={1}
                max={6}
                style={{ width: "100%" }}
                onChange={(value) => {
                  field.onChange(value);
                  clearFieldError("target_grade");
                }}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="exam_date"
          render={({ field }) => (
            <Form.Item
              label={t("examDateLabel")}
              validateStatus={fieldErrors.exam_date ? "error" : undefined}
              help={fieldErrors.exam_date}
            >
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => {
                  field.onChange(d ? d.format("YYYY-MM-DD") : null);
                  clearFieldError("exam_date");
                }}
                disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="weekly_goal_minutes"
          render={({ field }) => (
            <Form.Item
              label={t("weeklyMinutesLabel")}
              validateStatus={
                fieldErrors.weekly_goal_minutes ? "error" : undefined
              }
              help={fieldErrors.weekly_goal_minutes}
            >
              <InputNumber
                {...field}
                min={15}
                max={2000}
                step={30}
                style={{ width: "100%" }}
                onChange={(value) => {
                  field.onChange(value);
                  clearFieldError("weekly_goal_minutes");
                }}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="weak_areas"
          render={({ field }) => (
            <Form.Item
              label={t("weakAreasLabel")}
              validateStatus={fieldErrors.weak_areas ? "error" : undefined}
              help={fieldErrors.weak_areas}
            >
              <Select
                {...field}
                mode="multiple"
                allowClear
                options={weakAreaOptions}
                placeholder={t("weakAreasPlaceholder")}
                onChange={(value) => {
                  field.onChange(value);
                  clearFieldError("weak_areas");
                }}
              />
            </Form.Item>
          )}
        />

        <Form.Item
          validateStatus={fieldErrors.__save ? "error" : undefined}
          help={fieldErrors.__save}
        >
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={mutation.isPending}
          >
            {t("submit")}
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
}
