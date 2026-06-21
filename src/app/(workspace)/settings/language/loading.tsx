"use client";

// "use client": renders an antd compound skeleton (<Skeleton.Button>) for the
// save button. See SettingsPageSkeleton for the full RSC note.
import { Skeleton } from "antd";

import {
  SettingsPageSkeleton,
  SkeletonFieldRow,
} from "@/components/shared/SettingsPageSkeleton";

/**
 * `/settings/language` route loading skeleton — mirrors LanguageForm
 * (`.settings-form-stack` of label-left / control-right rows + right-aligned save
 * button) so navigation shows a layout-matched skeleton instead of the shared
 * AppLoading spinner.
 */
export default function LanguageSettingsLoading() {
  return (
    <SettingsPageSkeleton>
      <div className="settings-form-stack">
        <div className="settings-field-rows">
          <SkeletonFieldRow />
          <SkeletonFieldRow />
          <SkeletonFieldRow />
          <SkeletonFieldRow />
          <SkeletonFieldRow />
        </div>
        <div className="flex justify-end">
          <Skeleton.Button active size="large" className="w-[96px]" />
        </div>
      </div>
    </SettingsPageSkeleton>
  );
}
