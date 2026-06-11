"use client";

import type { ReactNode } from "react";
import {
  App,
  Button,
  DatePicker,
  Form,
  InputNumber,
  Segmented,
  Select,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Brain, CalendarDays, Clock3, Flag, Target } from "lucide-react";
import { useSaveLearningGoal } from "@/lib/learning/mutations";
import type { Tables } from "@/lib/supabase/types";
import { AppCard } from "@/components/shared/AppCard";

const { Title, Paragraph } = Typography;

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

const EXAM_DATE_PAST_ERROR = "examDatePast";

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

const SUPPORTED_GRADES: Record<FormValues["topik_level"], readonly number[]> = {
  TOPIK_I: [1, 2],
  TOPIK_II: [3, 4, 5, 6],
};

type FieldErrorKey = keyof FormValues | "__save";
type FieldErrors = Partial<Record<FieldErrorKey, string>>;

type Props = {
  userId: string;
  defaultValues?: Partial<Tables<"learning_goals">> | null;
  showIntro?: boolean;
};

type GoalFieldCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  required?: boolean;
  children: ReactNode;
};

function GoalFieldCard({
  icon,
  title,
  description,
  required,
  children,
}: GoalFieldCardProps) {
  return (
    <AppCard size="small">
      <div className="grid gap-4 md:grid-cols-2 md:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-default bg-surface text-text"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="min-w-0">
            <strong className="block text-sm leading-5 text-text">
              {required ? <span aria-hidden="true">* </span> : null}
              {title}
            </strong>
            <small className="mt-1 block text-xs leading-5 text-text-secondary">
              {description}
            </small>
          </span>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </AppCard>
  );
}

export function LearningGoalForm({
  userId,
  defaultValues,
  showIntro = true,
}: Props) {
  const t = useTranslations("onboarding.goalForm");
  const router = useRouter();
  const { notification } = App.useApp();
  const mutation = useSaveLearningGoal();

  const weakAreaOptions = WEAK_AREA_VALUES.map((value) => ({
    value,
    label: t(`weakAreas.${value}` as Parameters<typeof t>[0]),
  }));

  const resolveIssueMessage = (message: string) =>
    message === EXAM_DATE_PAST_ERROR
      ? t("errors.examDatePast")
      : t("errors.invalidField");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const { control, handleSubmit, getValues, setValue } = useForm<FormValues>({
    defaultValues: {
      topik_level: defaultValues?.topik_level ?? "TOPIK_II",
      target_grade: defaultValues?.target_grade ?? 4,
      exam_date: defaultValues?.exam_date ?? null,
      weekly_goal_minutes: defaultValues?.weekly_goal_minutes ?? 240,
      weak_areas: defaultValues?.weak_areas ?? [],
    },
  });

  const selectedTopikLevel =
    useWatch({ control, name: "topik_level" }) ?? "TOPIK_II";
  const targetGradeOptions = SUPPORTED_GRADES[selectedTopikLevel];

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
      setFieldErrors({
        __save:
          err instanceof Error
            ? t("errors.saveFailedDetail", { detail: err.message })
            : t("errors.saveFailed"),
      });
    }
  });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      {showIntro ? (
        <div>
          <Title level={3} className="!mb-1">
            {t("heading")}
          </Title>
          <Paragraph type="secondary" className="!m-0">
            {t("subheading")}
          </Paragraph>
        </div>
      ) : null}

      <Form
        className="grid gap-3"
        layout="vertical"
        onFinish={onSubmit}
        disabled={mutation.isPending}
      >
        <GoalFieldCard
          icon={<Flag size={23} />}
          title={t("topikLevelLabel")}
          description={t("topikLevelHelp")}
          required
        >
          <Controller
            control={control}
            name="topik_level"
            render={({ field }) => (
              <Form.Item
                className="!mb-0"
                validateStatus={fieldErrors.topik_level ? "error" : undefined}
                help={fieldErrors.topik_level}
              >
                <Select
                  {...field}
                  size="large"
                  className="w-full"
                  aria-label={t("topikLevelLabel")}
                  onChange={(value) => {
                    const nextLevel = value as FormValues["topik_level"];
                    const nextSupported = SUPPORTED_GRADES[nextLevel];
                    field.onChange(nextLevel);
                    clearFieldError("topik_level");
                    clearFieldError("target_grade");

                    const currentTarget = getValues("target_grade");
                    if (!nextSupported.includes(currentTarget)) {
                      setValue(
                        "target_grade",
                        nextSupported[nextSupported.length - 1],
                        { shouldDirty: true },
                      );
                    }
                  }}
                  options={[
                    { value: "TOPIK_I", label: t("topikLevelOptionI") },
                    { value: "TOPIK_II", label: t("topikLevelOptionII") },
                  ]}
                />
              </Form.Item>
            )}
          />
        </GoalFieldCard>

        <GoalFieldCard
          icon={<Target size={23} />}
          title={t("targetGradeLabel")}
          description={t("targetGradeHelp")}
          required
        >
          <Controller
            control={control}
            name="target_grade"
            render={({ field }) => (
              <Form.Item
                className="!mb-0"
                validateStatus={fieldErrors.target_grade ? "error" : undefined}
                help={fieldErrors.target_grade}
              >
                <Segmented
                  block
                  size="large"
                  aria-label={t("targetGradeLabel")}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    clearFieldError("target_grade");
                  }}
                  options={targetGradeOptions.map((grade) => ({
                    label: t("gradeOption", { grade }),
                    value: grade,
                  }))}
                />
              </Form.Item>
            )}
          />
        </GoalFieldCard>

        <GoalFieldCard
          icon={<CalendarDays size={23} />}
          title={t("examDateLabel")}
          description={t("examDateHelp")}
        >
          <Controller
            control={control}
            name="exam_date"
            render={({ field }) => (
              <Form.Item
                className="!mb-0"
                validateStatus={fieldErrors.exam_date ? "error" : undefined}
                help={fieldErrors.exam_date}
              >
                <DatePicker
                  size="large"
                  className="w-full"
                  aria-label={t("examDateLabel")}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => {
                    field.onChange(d ? d.format("YYYY-MM-DD") : null);
                    clearFieldError("exam_date");
                  }}
                  disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
                />
              </Form.Item>
            )}
          />
        </GoalFieldCard>

        <GoalFieldCard
          icon={<Clock3 size={23} />}
          title={t("weeklyMinutesLabel")}
          description={t("weeklyMinutesHelp")}
        >
          <Controller
            control={control}
            name="weekly_goal_minutes"
            render={({ field }) => (
              <Form.Item
                className="!mb-0"
                validateStatus={
                  fieldErrors.weekly_goal_minutes ? "error" : undefined
                }
                help={fieldErrors.weekly_goal_minutes}
              >
                <InputNumber
                  {...field}
                  size="large"
                  className="w-full"
                  aria-label={t("weeklyMinutesLabel")}
                  min={15}
                  max={2000}
                  step={30}
                  onChange={(value) => {
                    field.onChange(value);
                    clearFieldError("weekly_goal_minutes");
                  }}
                />
              </Form.Item>
            )}
          />
        </GoalFieldCard>

        <GoalFieldCard
          icon={<Brain size={23} />}
          title={t("weakAreasLabel")}
          description={t("weakAreasHelp")}
        >
          <Controller
            control={control}
            name="weak_areas"
            render={({ field }) => (
              <Form.Item
                className="!mb-0"
                validateStatus={fieldErrors.weak_areas ? "error" : undefined}
                help={fieldErrors.weak_areas}
              >
                <Select
                  {...field}
                  size="large"
                  className="w-full"
                  aria-label={t("weakAreasLabel")}
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
        </GoalFieldCard>

        <Form.Item
          className="!mb-0 pt-1"
          validateStatus={fieldErrors.__save ? "error" : undefined}
          help={fieldErrors.__save}
        >
          <Button
            size="large"
            type="primary"
            htmlType="submit"
            block
            loading={mutation.isPending}
          >
            {t("submit")}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
