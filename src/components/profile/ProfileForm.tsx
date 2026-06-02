"use client";

import { Alert, App, Avatar, Button, Form, Input, Space, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUpdateProfile } from "@/lib/settings/mutations";
import {
  avatarPublicUrl,
  squareCropImage,
  uploadAvatar,
  validateAvatarFile,
} from "./avatar-upload";

const { Paragraph } = Typography;

const PROFILE_NAME_MIN_LENGTH = 2;
const UNSAVED_PROFILE_LEAVE_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠어요?";

type ProfileDraft = {
  display_name: string | null;
  nickname: string | null;
  bio: string | null;
};

type Props = {
  /**
   * See `LanguageForm` for the rationale on accepting `userId` as a prop:
   * `useUpdateProfile` is per-user and the data layer is read-only.
   */
  userId: string;
  accountEmail: string | null;
  initialProfile: ProfileDraft;
  /** Current avatar storage path (avatars bucket). Optional. */
  initialAvatarPath?: string | null;
};

/**
 * Trim user input and collapse empty strings to `null` so the DB sees an
 * explicit field clear. Exported for direct unit testing.
 */
export function normalizeProfileField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeProfileDraft(profile: ProfileDraft): ProfileDraft {
  return {
    display_name: normalizeProfileField(profile.display_name ?? ""),
    nickname: normalizeProfileField(profile.nickname ?? ""),
    bio: normalizeProfileField(profile.bio ?? ""),
  };
}

function profilesEqual(left: ProfileDraft, right: ProfileDraft) {
  return (
    left.display_name === right.display_name &&
    left.nickname === right.nickname &&
    left.bio === right.bio
  );
}

function isTooShortProfileField(value: string | null) {
  return value !== null && value.length < PROFILE_NAME_MIN_LENGTH;
}

/**
 * Resolve a saved avatar path to its public URL, swallowing env-not-configured
 * errors (SSR/tests) so render/initialization never throws. Browser-only call
 * lives behind this guard.
 */
function safeAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  try {
    return avatarPublicUrl(path);
  } catch {
    return null;
  }
}

/**
 * `/profile` form (X-05). Avatar upload is intentionally shown as unavailable
 * until storage/upload behavior is implemented and verified.
 */
export function ProfileForm({
  userId,
  accountEmail,
  initialProfile,
  initialAvatarPath = null,
}: Props) {
  const { message } = App.useApp();
  const mutation = useUpdateProfile(userId);
  const [savedProfile, setSavedProfile] = useState<ProfileDraft>(() =>
    normalizeProfileDraft(initialProfile),
  );

  // X-05 region 3 (아바타): real upload to the avatars bucket. Preview URL is
  // derived lazily on first selection so render never touches the client.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 저장된 아바타의 public URL은 lazy initializer에서 한 번 안전하게 계산한다
  // (effect 안에서 setState 동기 호출 금지). 업로드 성공 시에는
  // handleAvatarSelect가 path와 url을 함께 갱신한다.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    safeAvatarUrl(initialAvatarPath),
  );
  const [avatarPath, setAvatarPath] = useState<string | null>(initialAvatarPath);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function handleAvatarSelect(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    // reset so re-selecting the same file fires change again.
    event.target.value = "";
    if (!file) return;
    setAvatarError(null);

    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      setAvatarError(validation.message);
      return;
    }

    setAvatarUploading(true);
    try {
      const { blob, ext } = await squareCropImage(file);
      const result = await uploadAvatar(userId, blob, ext);
      setAvatarPath(result.path);
      setAvatarUrl(result.publicUrl);
      message.success("프로필 이미지를 업데이트했어요.");
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "이미지 업로드에 실패했어요.",
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  const [displayName, setDisplayName] = useState<string>(
    initialProfile.display_name ?? "",
  );
  const [nickname, setNickname] = useState<string>(
    initialProfile.nickname ?? "",
  );
  const [bio, setBio] = useState<string>(initialProfile.bio ?? "");

  const draftProfile = useMemo(
    () =>
      normalizeProfileDraft({
        display_name: displayName,
        nickname,
        bio,
      }),
    [bio, displayName, nickname],
  );
  const isDirty = !profilesEqual(draftProfile, savedProfile);
  const displayNameTooShort = isTooShortProfileField(draftProfile.display_name);
  const nicknameTooShort = isTooShortProfileField(draftProfile.nickname);
  const validationError = displayNameTooShort
    ? "이름은 2자 이상 입력해 주세요."
    : nicknameTooShort
      ? "닉네임은 2자 이상 입력해 주세요."
      : null;
  const canSubmit = isDirty && !validationError;
  const avatarInitial =
    (draftProfile.display_name ?? draftProfile.nickname ?? accountEmail ?? "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      if (!window.confirm(UNSAVED_PROFILE_LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  async function handleFinish() {
    if (!isDirty) return;
    if (validationError) {
      message.error(validationError);
      return;
    }

    try {
      await mutation.mutateAsync(draftProfile);
      setSavedProfile(draftProfile);
      message.success("프로필이 저장되었습니다.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "저장에 실패했어요.");
    }
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Form.Item
        label="이메일"
        extra="이메일 변경은 재인증이 필요하며, 보안상 일정 기간 내 변경 횟수가 제한됩니다."
      >
        <Input
          value={accountEmail ?? ""}
          readOnly
          placeholder="등록된 이메일 없음"
          aria-label="이메일"
        />
      </Form.Item>

      <Form.Item
        label="이름"
        validateStatus={displayNameTooShort ? "error" : undefined}
        help={
          displayNameTooShort ? "이름은 2자 이상 입력해 주세요." : undefined
        }
      >
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="실명 또는 표시 이름"
          maxLength={30}
          aria-label="이름"
        />
      </Form.Item>

      <Form.Item
        label="닉네임"
        validateStatus={nicknameTooShort ? "error" : undefined}
        help={
          nicknameTooShort
            ? "닉네임은 2자 이상 입력해 주세요."
            : "이미 사용 중인 닉네임이면 저장 시 안내됩니다."
        }
      >
        <Input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="다른 사용자에게 보여질 이름"
          maxLength={20}
          aria-label="닉네임"
        />
      </Form.Item>

      <Form.Item label="자기소개" extra={`${bio.length}/160자`}>
        <Input.TextArea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="간단한 자기소개 (160자 이내)"
          maxLength={160}
          autoSize={{ minRows: 2, maxRows: 4 }}
          aria-label="자기소개"
        />
      </Form.Item>

      <section
        aria-label="프로필 이미지 영역"
        style={{
          border: "1px solid var(--ant-color-border)",
          borderRadius: 8,
          marginBottom: 16,
          padding: 16,
        }}
      >
        <Space align="start" size="middle">
          {avatarUrl ? (
            <Avatar size={56} src={avatarUrl} alt="프로필 이미지" />
          ) : (
            <Avatar size={56}>{avatarInitial}</Avatar>
          )}
          <div>
            <Paragraph strong style={{ marginTop: 0, marginBottom: 4 }}>
              프로필 이미지
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              JPG 또는 PNG, 5MB 이하. 정사각형으로 자동 자릅니다.
            </Paragraph>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              aria-label="프로필 이미지 파일 선택"
              onChange={handleAvatarSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              loading={avatarUploading}
              aria-label="이미지 업로드"
            >
              {avatarUploading ? "업로드 중..." : "이미지 변경"}
            </Button>
          </div>
        </Space>
        {avatarError ? (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message={avatarError}
            action={
              <Button size="small" onClick={() => fileInputRef.current?.click()}>
                다시 선택
              </Button>
            }
          />
        ) : null}
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="보안 안내"
          description="이메일 등 계정 식별 정보 변경은 향후 재인증이 필요할 수 있습니다. 이름·닉네임·자기소개 변경은 바로 저장됩니다."
        />
      </section>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={mutation.isPending}
          disabled={!canSubmit || mutation.isPending}
          aria-label="프로필 저장"
        >
          저장
        </Button>
      </Form.Item>
    </Form>
  );
}
