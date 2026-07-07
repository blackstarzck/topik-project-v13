import type { ReactNode } from "react";
import { Typography } from "antd";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const { Title } = Typography;

type BaseProps = {
  testId: string;
  title: ReactNode;
  actions: ReactNode;
};

type Props =
  | (BaseProps & {
      backHref: string;
      backLabel: string;
      backTestId?: string;
    })
  | (BaseProps & {
      backHref?: undefined;
      backLabel?: never;
      backTestId?: never;
    });

export function ReportPageHeader({
  testId,
  title,
  actions,
  backHref,
  backLabel,
  backTestId,
}: Props) {
  return (
    <div
      data-testid={testId}
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div
        data-testid="report-page-header-inner"
        className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-3 px-4 py-4 pr-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:pr-20"
      >
        <div
          data-testid="report-page-header-title"
          className="flex min-w-0 items-center gap-3"
        >
          {backHref ? (
            <Link
              aria-label={backLabel}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              data-testid={backTestId}
              href={backHref}
            >
              <ArrowLeft aria-hidden size={22} strokeWidth={2} />
            </Link>
          ) : null}
          <Title level={3} className="!m-0 text-2xl">
            {title}
          </Title>
        </div>
        <div
          data-testid="report-page-header-actions"
          className="w-full shrink-0 lg:w-auto"
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
