"use client";

// "use client": renders antd compound skeletons (<Skeleton.Avatar>/<Skeleton.Button>),
// which resolve to `undefined` in an RSC. See SettingsPageSkeleton for the full note.
import { Skeleton } from "antd";

import {
  SettingsPageSkeleton,
  SkeletonField,
} from "@/components/shared/SettingsPageSkeleton";

/**
 * `/profile` route loading skeleton — mirrors ProfileForm (avatar block + 4 input
 * fields + save button) so navigation shows a layout-matched skeleton instead of
 * the shared AppLoading spinner.
 */
export default function ProfileLoading() {
  return (
    <SettingsPageSkeleton>
      <div className="flex flex-col gap-8">
        {/* 아바타 영역: 라벨 + 원형 아바타 + 버튼 2개 + 안내 문구 */}
        <div className="flex flex-col gap-3">
          <Skeleton.Button active size="small" className="w-[96px]" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Skeleton.Avatar active size={72} shape="circle" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton.Button active className="w-[120px]" />
                <Skeleton.Button active className="w-[96px]" />
              </div>
              <Skeleton
                active
                title={false}
                paragraph={{ rows: 2, width: ["70%", "55%"] }}
              />
            </div>
          </div>
        </div>

        {/* 입력 필드 4개(이름 · 닉네임 · 국가/지역 · 소개) */}
        <div className="flex flex-col gap-8">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
        </div>

        {/* 저장 버튼 */}
        <Skeleton.Button active className="w-[96px]" />
      </div>
    </SettingsPageSkeleton>
  );
}
