"use client";

import { Skeleton } from "antd";
import { AppCard } from "@/components/shared/AppCard";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";

function HeaderActionsSkeleton() {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[120px]" />
      <Skeleton.Button active className="w-[88px]" />
    </div>
  );
}

export default function CompareReportLoading() {
  return (
    <div
      data-testid="comparison-page-loading"
      className="relative flex min-h-full w-full flex-col overflow-x-hidden bg-background"
    >
      <ReportPageHeader
        testId="comparison-page-header"
        title={<Skeleton.Button active className="w-[160px]" />}
        actions={<HeaderActionsSkeleton />}
      />

      <div className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <AppCard>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-center">
            <Skeleton active avatar paragraph={{ rows: 1 }} />
            <Skeleton.Avatar active shape="circle" />
            <Skeleton active avatar paragraph={{ rows: 1 }} />
            <Skeleton.Button active className="w-[140px]" />
          </div>
        </AppCard>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <AppCard key={index}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </AppCard>
          ))}
        </div>

        <AppCard>
          <Skeleton active paragraph={{ rows: 2 }} />
        </AppCard>

        <AppCard>
          <Skeleton active paragraph={{ rows: 8 }} />
        </AppCard>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <AppCard key={index}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </AppCard>
          ))}
        </div>

        <AppCard>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton active paragraph={{ rows: 5 }} />
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        </AppCard>
      </div>
    </div>
  );
}
