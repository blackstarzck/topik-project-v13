import { Button } from "antd";
import { LogOut } from "lucide-react";

type ProfileLogoutFormProps = {
  label: string;
};

export function ProfileLogoutForm({ label }: ProfileLogoutFormProps) {
  return (
    <form
      method="post"
      action="/auth/sign-out"
      className="app-profile-logout"
    >
      <Button
        htmlType="submit"
        icon={<LogOut aria-hidden size={16} strokeWidth={1.8} />}
        data-testid="profile-logout"
      >
        {label}
      </Button>
    </form>
  );
}
