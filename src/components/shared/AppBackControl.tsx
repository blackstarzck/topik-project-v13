import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type BaseProps = {
  label: string;
  testId?: string;
  className?: string;
};

type Props =
  | (BaseProps & {
      href: string;
      onClick?: never;
    })
  | (BaseProps & {
      href?: never;
      onClick: () => void;
    });

const BACK_CONTROL_CLASS_NAME =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export function AppBackControl({
  label,
  testId,
  className,
  href,
  onClick,
}: Props) {
  const resolvedClassName = [BACK_CONTROL_CLASS_NAME, className]
    .filter(Boolean)
    .join(" ");
  const icon = <ArrowLeft aria-hidden size={22} strokeWidth={2} />;

  if (href) {
    return (
      <Link
        aria-label={label}
        className={resolvedClassName}
        data-testid={testId}
        href={href}
        replace
      >
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      className={resolvedClassName}
      data-testid={testId}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
