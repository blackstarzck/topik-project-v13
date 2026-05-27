"use client";

import { App, Button, Form, Input, Typography } from "antd";
import { useState } from "react";

import { useUpdateProfile } from "@/lib/settings/mutations";

const { Paragraph } = Typography;

type Props = {
  /**
   * See `LanguageForm` for the rationale on accepting `userId` as a prop —
   * `useUpdateProfile` is per-user and the data layer is read-only.
   */
  userId: string;
  initialProfile: {
    display_name: string | null;
    nickname: string | null;
    // Phase 7-E Task 10 (P1-6) — bio (160자 자기소개).
    bio: string | null;
  };
};

/**
 * Trim user input and collapse empty strings to `null` so the DB sees an
 * explicit field clear. Exported for direct unit testing — the form
 * onSubmit pipes raw inputs through this helper before invoking the
 * mutation.
 */
export function normalizeProfileField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * `/profile` form (X-05). Two optional text inputs: display_name + nickname.
 * Avatar upload is OOS for Phase 6 (Plan rev4 / light spec).
 */
export function ProfileForm({ userId, initialProfile }: Props) {
  const { message } = App.useApp();
  const mutation = useUpdateProfile(userId);

  const [displayName, setDisplayName] = useState<string>(
    initialProfile.display_name ?? "",
  );
  const [nickname, setNickname] = useState<string>(
    initialProfile.nickname ?? "",
  );
  const [bio, setBio] = useState<string>(initialProfile.bio ?? "");

  async function handleFinish() {
    const payload = {
      display_name: normalizeProfileField(displayName),
      nickname: normalizeProfileField(nickname),
      // Phase 7-E Task 10 — bio (max 160 chars enforced by DB CHECK + form maxLength).
      bio: normalizeProfileField(bio),
    };
    try {
      await mutation.mutateAsync(payload);
      message.success("프로필이 저장되었습니다.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "저장에 실패했어요.",
      );
    }
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Form.Item label="이름">
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="실명 또는 표시 이름"
          maxLength={80}
          aria-label="이름"
        />
      </Form.Item>

      <Form.Item label="닉네임">
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="다른 사용자에게 보여질 이름"
          maxLength={40}
          aria-label="닉네임"
        />
      </Form.Item>

      {/* Phase 7-E Task 10 (P1-6) — bio (자기소개 160자). */}
      <Form.Item label="자기소개" extra={`${bio.length}/160자`}>
        <Input.TextArea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="간단한 자기소개 (160자 이내)"
          maxLength={160}
          autoSize={{ minRows: 2, maxRows: 4 }}
          aria-label="자기소개"
        />
      </Form.Item>

      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        아바타 업로드는 다음 업데이트에서 지원됩니다.
      </Paragraph>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={mutation.isPending}
        >
          저장
        </Button>
      </Form.Item>
    </Form>
  );
}
