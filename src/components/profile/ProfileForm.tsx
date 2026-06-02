"use client";

import { Alert, App, Avatar, Button, Form, Input, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUpdateProfile } from "@/lib/settings/mutations";
import {
  AvatarError,
  avatarPublicUrl,
  squareCropImage,
  uploadAvatar,
  validateAvatarFile,
} from "./avatar-upload";

const { Paragraph } = Typography;

const PROFILE_NAME_MIN_LENGTH = 2;

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
  const t = useTranslations("profile.form");
  const tAvatar = useTranslations("profile.avatar");
  const tCommon = useTranslations("common");
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
      setAvatarError(
        tAvatar(validation.messageKey as Parameters<typeof tAvatar>[0]),
      );
      return;
    }

    setAvatarUploading(true);
    try {
      const { blob, ext } = await squareCropImage(file);
      const result = await uploadAvatar(userId, blob, ext);
      setAvatarPath(result.path);
      setAvatarUrl(result.publicUrl);
      message.success(tAvatar("uploadSuccess"));
    } catch (err) {
      // AvatarError는 카탈로그 키를 들고 오므로 t()로 해석하고, 그 외(Supabase 등
      // 서비스 계층 에러)는 기본 업로드 실패 문구로 대체한다.
      setAvatarError(
        err instanceof AvatarError
          ? tAvatar(err.messageKey as Parameters<typeof tAvatar>[0])
          : tAvatar("uploadFailed"),
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
    ? t("nameTooShort")
    : nicknameTooShort
      ? t("nicknameTooShort")
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

      if (!window.confirm(t("unsavedLeavePrompt"))) {
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
  }, [isDirty, t]);

  async function handleFinish() {
    if (!isDirty) return;
    if (validationError) {
      message.error(validationError);
      return;
    }

    try {
      await mutation.mutateAsync(draftProfile);
      setSavedProfile(draftProfile);
      message.success(t("saveSuccess"));
    } catch (err) {
      // err.message 는 데이터 계층(useUpdateProfile, src/lib/settings)에서 온
      // 서비스 메시지이므로 그대로 노출하고, 없으면 기본 저장 실패 문구로 대체.
      message.error(err instanceof Error ? err.message : t("saveError"));
    }
  }

  return (
    <Form
      layout="vertical"
      onFinish={handleFinish}
      disabled={mutation.isPending}
    >
      <Form.Item
        label={t("emailLabel")}
        extra={t("emailExtra")}
      >
        <Input
          value={accountEmail ?? ""}
          readOnly
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailLabel")}
        />
      </Form.Item>

      <Form.Item
        label={t("nameLabel")}
        validateStatus={displayNameTooShort ? "error" : undefined}
        help={displayNameTooShort ? t("nameTooShort") : undefined}
      >
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={30}
          aria-label={t("nameLabel")}
        />
      </Form.Item>

      <Form.Item
        label={t("nicknameLabel")}
        validateStatus={nicknameTooShort ? "error" : undefined}
        help={nicknameTooShort ? t("nicknameTooShort") : t("nicknameHelp")}
      >
        <Input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder={t("nicknamePlaceholder")}
          maxLength={20}
          aria-label={t("nicknameLabel")}
        />
      </Form.Item>

      <Form.Item label={t("bioLabel")} extra={t("bioCount", { count: bio.length })}>
        <Input.TextArea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder={t("bioPlaceholder")}
          maxLength={160}
          autoSize={{ minRows: 2, maxRows: 4 }}
          aria-label={t("bioLabel")}
        />
      </Form.Item>

      <section
        aria-label={tAvatar("regionAriaLabel")}
        style={{
          border: "1px solid var(--ant-color-border)",
          borderRadius: 8,
          marginBottom: 16,
          padding: 16,
        }}
      >
        <Space align="start" size="middle">
          {avatarUrl ? (
            <Avatar size={56} src={avatarUrl} alt={tAvatar("imageAlt")} />
          ) : (
            <Avatar size={56}>{avatarInitial}</Avatar>
          )}
          <div>
            <Paragraph strong style={{ marginTop: 0, marginBottom: 4 }}>
              {tAvatar("title")}
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {tAvatar("constraints")}
            </Paragraph>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              aria-label={tAvatar("fileInputAriaLabel")}
              onChange={handleAvatarSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              loading={avatarUploading}
              aria-label={tAvatar("uploadAriaLabel")}
            >
              {avatarUploading ? tAvatar("uploading") : tAvatar("changeImage")}
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
                {tAvatar("reselect")}
              </Button>
            }
          />
        ) : null}
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message={tAvatar("securityNoticeTitle")}
          description={tAvatar("securityNoticeDescription")}
        />
      </section>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={mutation.isPending}
          disabled={!canSubmit || mutation.isPending}
          aria-label={t("saveAriaLabel")}
        >
          {tCommon("save")}
        </Button>
      </Form.Item>
    </Form>
  );
}
