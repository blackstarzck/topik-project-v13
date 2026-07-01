import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { APP_ROUTES } from "@/lib/routes";

type Props = {
  label: string;
  testId?: string;
};

export function LibraryProblemsBackLink({ label, testId }: Props) {
  return (
    <Link
      aria-label={label}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      data-testid={testId}
      href={APP_ROUTES.library}
    >
      <ArrowLeft aria-hidden size={22} strokeWidth={2} />
    </Link>
  );
}
