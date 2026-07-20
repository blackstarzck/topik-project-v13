"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { Bookmark as BookmarkIcon } from "lucide-react";
import { App, Button } from "antd";
import { useTranslations } from "next-intl";

import {
  isDuplicateLibrarySaveError,
  useDeleteProblemLibraryItem,
  useSaveLibraryItem,
} from "@/lib/library/mutations";

type Props = {
  userId: string;
  problemId: string;
  initiallySaved: boolean;
  disabled?: boolean;
  className?: string;
};

export function ProblemBookmarkToggle({
  userId,
  problemId,
  initiallySaved,
  disabled = false,
  className,
}: Props) {
  const t = useTranslations("practice.problems");
  const { message } = App.useApp();
  const save = useSaveLibraryItem();
  const remove = useDeleteProblemLibraryItem();
  const [savedOverride, setSavedOverride] = useState<{
    problemId: string;
    value: boolean;
  } | null>(null);

  const saved =
    savedOverride?.problemId === problemId
      ? savedOverride.value
      : initiallySaved;
  const pending = save.isPending || remove.isPending;

  function handleClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    if (disabled || pending) return;

    if (saved) {
      remove.mutate(
        {
          user_id: userId,
          problem_id: problemId,
        },
        {
          onSuccess: () => {
            setSavedOverride({ problemId, value: false });
            message.success(t("removeProblemSuccess"));
          },
          onError: () => {
            message.error(t("removeProblemFailed"));
          },
        },
      );
      return;
    }

    save.mutate(
      {
        user_id: userId,
        item_type: "problem",
        problem_id: problemId,
      },
      {
        onSuccess: () => {
          setSavedOverride({ problemId, value: true });
          message.success(t("saveProblemSuccess"));
        },
        onError: (error: unknown) => {
          if (isDuplicateLibrarySaveError(error)) {
            setSavedOverride({ problemId, value: true });
            message.info(t("savedProblem"));
            return;
          }
          message.error(t("saveProblemFailed"));
        },
      },
    );
  }

  const label = saved ? t("savedProblem") : t("saveProblem");
  const buttonClassName = [
    "problem-bookmark-toggle",
    className,
    saved ? "problem-bookmark-toggle--saved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Button
      className={buttonClassName}
      icon={
        <BookmarkIcon
          aria-hidden
          fill={saved ? "currentColor" : "none"}
          size={16}
          strokeWidth={2}
        />
      }
      loading={pending}
      disabled={disabled}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={handleClick}
    />
  );
}
