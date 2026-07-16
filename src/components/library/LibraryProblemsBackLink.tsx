import { AppBackControl } from "@/components/shared/AppBackControl";
import { APP_ROUTES } from "@/lib/routes";

type Props = {
  label: string;
  testId?: string;
};

export function LibraryProblemsBackLink({ label, testId }: Props) {
  return (
    <AppBackControl
      href={APP_ROUTES.library}
      label={label}
      testId={testId}
    />
  );
}
