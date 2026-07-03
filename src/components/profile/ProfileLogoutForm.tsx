import { Button } from "antd";

type ProfileLogoutFormProps = {
  label: string;
};

export function ProfileLogoutForm({ label }: ProfileLogoutFormProps) {
  return (
    <form method="post" action="/auth/sign-out" className="app-profile-logout">
      <Button
        type="primary"
        size="large"
        htmlType="submit"
        data-testid="profile-logout"
      >
        {label}
      </Button>
    </form>
  );
}
