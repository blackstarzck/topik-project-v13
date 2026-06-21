"use client";

// "use client": renders an antd compound skeleton (<Skeleton.Button>) for the
// save button. See SettingsPageSkeleton for the full RSC note.
import { Skeleton } from "antd";

import {
  SettingsPageSkeleton,
  SkeletonFieldRow,
} from "@/components/shared/SettingsPageSkeleton";

/**
 * `/settings/learning` route loading skeleton — mirrors ExamGoalForm (3 label-left
 * / control-right rows + right-aligned save button) so navigation shows a
 * layout-matched skeleton instead of the shared AppLoading spinner.
 */
export default function LearningSettingsLoading() {
  return (
    <SettingsPageSkeleton>
      <div>
        <SkeletonFieldRow />
        <SkeletonFieldRow />
        <SkeletonFieldRow />
        <div className="mt-4 flex justify-end">
          <Skeleton.Button active size="large" className="w-[96px]" />
        </div>
      </div>
    </SettingsPageSkeleton>
  );
}
