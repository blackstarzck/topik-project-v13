"use client";

import { Button, Progress, Typography } from "antd";
import { ArrowLeft, Clock3, PenLine, SendHorizontal } from "@/components/shared/AppIcons";
import type { ReactNode } from "react";

import type { AutosaveStatus } from "@/lib/writing/types";
import { AutosaveBadge } from "./AutosaveBadge";

const { Text } = Typography;

type Props = {
  title: string;
  subtitle: string;
  progressPercent: number;
  elapsedSeconds: number;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: string | null;
  canSave: boolean;
  canSubmit: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onRequestBack: () => void;
  children: ReactNode;
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function WritingExamShell({
  title,
  subtitle,
  progressPercent,
  elapsedSeconds,
  autosaveStatus,
  lastSavedAt,
  canSave,
  canSubmit,
  isSaving,
  isSubmitting,
  onSave,
  onSubmit,
  onRequestBack,
  children,
}: Props) {
  return (
    <div className="writing-exam-shell">
      <header className="writing-exam-header">
        <div className="writing-exam-header__identity">
          <button
            type="button"
            className="writing-exam-header__back"
            aria-label="문제 목록으로 돌아가기"
            onClick={() => onRequestBack()}
          >
            <ArrowLeft aria-hidden size={20} />
          </button>
          <div className="writing-exam-header__titles">
            <div className="writing-exam-header__title-row">
              <h1 className="writing-exam-header__title">{title}</h1>
            </div>
            <p className="writing-exam-header__subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="writing-exam-header__progress" aria-label="작성 진행률">
          <Text className="writing-exam-header__progress-label">
            {progressPercent}%
          </Text>
          <Progress
            percent={progressPercent}
            showInfo={false}
            size="small"
            status="active"
          />
        </div>

        <div className="writing-exam-header__actions writing-exam-actions--minimal">
          <span className="writing-exam-header__timer">
            <Clock3 aria-hidden size={16} strokeWidth={2.4} />
            {formatElapsed(elapsedSeconds)}
          </span>
          <span className="writing-exam-header__save-state">
            <AutosaveBadge status={autosaveStatus} lastSavedAt={lastSavedAt} />
          </span>
          <Button
            className="writing-exam-header__save-button"
            icon={<PenLine aria-hidden size={16} />}
            onClick={onSave}
            loading={isSaving}
            disabled={!canSave}
          >
            저장
          </Button>
          <Button
            type="primary"
            className="writing-exam-header__submit-button"
            icon={<SendHorizontal aria-hidden size={16} />}
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            제출하기
          </Button>
        </div>
      </header>

      <main className="writing-exam-main">{children}</main>
    </div>
  );
}
