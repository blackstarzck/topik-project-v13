"use client";

import { Button } from "antd";
import { useRef, useState, type FormEvent } from "react";

import { clearClientRecoveryForLogout } from "@/lib/writing/client-recovery-cleanup";

type ProfileLogoutFormProps = {
  label: string;
  userId: string;
};

export function ProfileLogoutForm({ label, userId }: ProfileLogoutFormProps) {
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const form = event.currentTarget;
    void clearClientRecoveryForLogout(userId).finally(() => form.submit());
  }

  return (
    <form
      method="post"
      action="/auth/sign-out"
      className="app-profile-logout"
      onSubmit={handleSubmit}
    >
      <Button
        type="primary"
        size="large"
        htmlType="submit"
        loading={submitting}
        disabled={submitting}
        data-testid="profile-logout"
      >
        {label}
      </Button>
    </form>
  );
}
