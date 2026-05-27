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
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSaveLearningGoal } from "@/lib/learning/mutations";
import type { Tables } from "@/lib/supabase/types";

const { Title, Paragraph } = Typography;

const WEAK_AREA_OPTIONS = [
  { value: "vocabulary", label: "어휘" },
  { value: "grammar", label: "문법" },
  { value: "reading-comprehension", label: "읽기 이해" },
  { value: "listening-comprehension", label: "듣기 이해" },
  { value: "essay-thesis", label: "논술 주제" },
  { value: "essay-structure", label: "논술 구조" },
  { value: "short-answer", label: "단답 작성" },
  { value: "long-form-cohesion", label: "장문 결속" },
];

const schema = z.object({
  topik_level: z.enum(["TOPIK_I", "TOPIK_II"]),
  target_grade: z.number().int().min(1).max(6),
  exam_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => !v || !dayjs(v).startOf("day").isBefore(dayjs().startOf("day")),
      "과거 날짜는 선택할 수 없습니다.",
    ),
  weekly_goal_minutes: z.number().int().min(15).max(2000).optional().nullable(),
  weak_areas: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  userId: string;
  defaultValues?: Partial<Tables<"learning_goals">> | null;
};

export function LearningGoalForm({ userId, defaultValues }: Props) {
  const router = useRouter();
  const { notification } = App.useApp();
  const mutation = useSaveLearningGoal();

  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      topik_level: defaultValues?.topik_level ?? "TOPIK_II",
      target_grade: defaultValues?.target_grade ?? 4,
      exam_date: defaultValues?.exam_date ?? null,
      weekly_goal_minutes: defaultValues?.weekly_goal_minutes ?? 240,
      weak_areas: defaultValues?.weak_areas ?? [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      notification.error({
        message: "입력 확인이 필요해요",
        description: firstIssue?.message ?? "필수 항목을 다시 확인해주세요.",
      });
      return;
    }
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
      notification.success({ message: "학습 목표가 저장되었어요" });
      router.push("/dashboard");
    } catch (err) {
      notification.error({
        message: "저장에 실패했어요",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
      });
    }
  });

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          학습 목표 설정
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          목표 설정은 맞춤 추천의 기반이 됩니다.
        </Paragraph>
      </div>

      <Form layout="vertical" onFinish={onSubmit} disabled={mutation.isPending}>
        <Controller
          control={control}
          name="topik_level"
          render={({ field }) => (
            <Form.Item label="TOPIK 등급" required>
              <Select
                {...field}
                options={[
                  { value: "TOPIK_I", label: "TOPIK I (1-2급)" },
                  { value: "TOPIK_II", label: "TOPIK II (3-6급)" },
                ]}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="target_grade"
          render={({ field }) => (
            <Form.Item label="목표 등급" required>
              <InputNumber
                {...field}
                min={1}
                max={6}
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="exam_date"
          render={({ field }) => (
            <Form.Item label="시험 일정 (선택)">
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) =>
                  field.onChange(d ? d.format("YYYY-MM-DD") : null)
                }
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
            <Form.Item label="주당 학습 시간 (분, 선택)">
              <InputNumber
                {...field}
                min={15}
                max={2000}
                step={30}
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="weak_areas"
          render={({ field }) => (
            <Form.Item label="취약 영역 (선택)">
              <Select
                {...field}
                mode="multiple"
                allowClear
                options={WEAK_AREA_OPTIONS}
                placeholder="여러 항목을 선택할 수 있어요"
              />
            </Form.Item>
          )}
        />

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={mutation.isPending}
            disabled={!formState.isValid && formState.isSubmitted}
          >
            저장하고 대시보드로 이동
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
}
