"use client";

import { Alert, App, Avatar, Button, Form, Input, Typography } from "antd";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import {
  checkNicknameAvailability,
  NicknameTakenError,
  useUpdateProfile,
} from "@/lib/settings/mutations";
import {
  AvatarError,
  avatarPublicUrl,
  removeAvatar,
  squareCropImage,
  uploadAvatar,
  validateAvatarFile,
} from "./avatar-upload";

const { Paragraph, Text } = Typography;

const PROFILE_NAME_MIN_LENGTH = 2;
const NICKNAME_CHECK_DEBOUNCE_MS = 500;

type NicknameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "failed";
type FormValidateStatus = "success" | "warning" | "error" | "validating";

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
  const [avatarPath, setAvatarPath] = useState<string | null>(
    initialAvatarPath,
  );
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

  async function handleAvatarRemove() {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await removeAvatar(userId, avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
      message.success(tAvatar("removeSuccess"));
    } catch (err) {
      setAvatarError(
        err instanceof AvatarError
          ? tAvatar(err.messageKey as Parameters<typeof tAvatar>[0])
          : tAvatar("removeFailed"),
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
  const [nicknameAvailability, setNicknameAvailability] =
    useState<NicknameAvailability>("idle");
  const nicknameCheckSeqRef = useRef(0);
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
  const nicknameAvailabilityBlocksSubmit =
    nicknameAvailability === "checking" || nicknameAvailability === "taken";
  const canSubmit =
    isDirty && !validationError && !nicknameAvailabilityBlocksSubmit;
  const nicknameValidateStatus: FormValidateStatus | undefined =
    nicknameTooShort || nicknameAvailability === "taken"
      ? "error"
      : nicknameAvailability === "checking"
        ? "validating"
        : nicknameAvailability === "available"
          ? "success"
          : nicknameAvailability === "failed"
            ? "warning"
            : undefined;
  const nicknameHelp = nicknameTooShort
    ? t("nicknameTooShort")
    : nicknameAvailability === "taken"
      ? t("nicknameTaken")
      : nicknameAvailability === "checking"
        ? t("nicknameChecking")
        : nicknameAvailability === "available"
          ? t("nicknameAvailable")
          : nicknameAvailability === "failed"
            ? t("nicknameCheckFailed")
            : t("nicknameHelp");
  const avatarInitial =
    (draftProfile.display_name ?? draftProfile.nickname ?? accountEmail ?? "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";
  const saveHint = !isDirty ? t("unchangedHint") : null;
  const saveDisabled = !canSubmit || mutation.isPending;

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

  useEffect(() => {
    const normalizedNickname = draftProfile.nickname;
    const savedNickname = savedProfile.nickname;
    const nextSeq = nicknameCheckSeqRef.current + 1;
    nicknameCheckSeqRef.current = nextSeq;

    if (
      normalizedNickname === null ||
      normalizedNickname.length < PROFILE_NAME_MIN_LENGTH ||
      normalizedNickname === savedNickname
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (nicknameCheckSeqRef.current !== nextSeq) return;
      setNicknameAvailability("checking");
      void checkNicknameAvailability(normalizedNickname)
        .then((available) => {
          if (nicknameCheckSeqRef.current !== nextSeq) return;
          setNicknameAvailability(available ? "available" : "taken");
        })
        .catch(() => {
          if (nicknameCheckSeqRef.current !== nextSeq) return;
          setNicknameAvailability("failed");
        });
    }, NICKNAME_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftProfile.nickname, savedProfile.nickname]);

  async function handleFinish() {
    if (!isDirty) return;
    if (validationError) {
      message.error(validationError);
      return;
    }
    if (nicknameAvailability === "checking") {
      message.error(t("nicknameChecking"));
      return;
    }
    if (nicknameAvailability === "taken") {
      message.error(t("nicknameTaken"));
      return;
    }

    try {
      await mutation.mutateAsync(draftProfile);
      setSavedProfile(draftProfile);
      setNicknameAvailability("idle");
      message.success(t("saveSuccess"));
    } catch (err) {
      if (err instanceof NicknameTakenError) {
        setNicknameAvailability("taken");
        message.error(t("nicknameTaken"));
        return;
      }
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
      <AppCard
        size="small"
        role="region"
        aria-label={t("settingsRegionAriaLabel")}
        className="profile-settings-card"
      >
        <Form.Item label={t("emailLabel")} extra={t("emailExtra")} required>
          <Input
            value={accountEmail ?? ""}
            readOnly
            placeholder={t("emailPlaceholder")}
            aria-label={t("emailLabel")}
          />
        </Form.Item>

        <Form.Item
          label={t("nameLabel")}
          required
          validateStatus={displayNameTooShort ? "error" : undefined}
          help={displayNameTooShort ? t("nameTooShort") : t("nameHelp")}
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
          required
          validateStatus={nicknameValidateStatus}
          help={nicknameHelp}
        >
          <Input
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setNicknameAvailability("idle");
            }}
            placeholder={t("nicknamePlaceholder")}
            maxLength={20}
            aria-label={t("nicknameLabel")}
          />
        </Form.Item>

        <Form.Item label={t("bioLabel")} extra={t("bioHelp")}>
          <Input.TextArea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder={t("bioPlaceholder")}
            maxLength={160}
            showCount={{
              formatter: ({ count }) => t("bioCount", { count }),
            }}
            autoSize={{ minRows: 3, maxRows: 5 }}
            aria-label={t("bioLabel")}
          />
        </Form.Item>

        <div className="mb-4">
          <Paragraph strong className="!mb-2 !mt-0">
            {tAvatar("title")}
          </Paragraph>
          <div
            role="region"
            aria-label={tAvatar("regionAriaLabel")}
            className="rounded-default border border-border px-4 py-3"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {avatarUrl ? (
                <Avatar size={72} src={avatarUrl} alt={tAvatar("imageAlt")} />
              ) : (
                <Avatar size={72}>{avatarInitial}</Avatar>
              )}
              <div className="min-w-0 flex-1">
                <Paragraph type="secondary" className="!mb-2">
                  {tAvatar("constraints")}
                </Paragraph>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  hidden
                  aria-label={tAvatar("fileInputAriaLabel")}
                  onChange={handleAvatarSelect}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    loading={avatarUploading}
                    aria-label={tAvatar("uploadAriaLabel")}
                  >
                    {avatarUploading
                      ? tAvatar("uploading")
                      : tAvatar("changeImage")}
                  </Button>
                  <Button
                    disabled={!avatarPath || avatarUploading}
                    onClick={handleAvatarRemove}
                  >
                    {tAvatar("removeImage")}
                  </Button>
                </div>
                <Paragraph type="secondary" className="!mb-0 !mt-2">
                  {tAvatar("recommendedSize")}
                </Paragraph>
              </div>
            </div>
            {avatarError ? (
              <Alert
                type="error"
                showIcon
                className="mt-3"
                title={avatarError}
                action={
                  <Button
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {tAvatar("reselect")}
                  </Button>
                }
              />
            ) : null}
          </div>
        </div>

        <Alert
          className="mt-3"
          type="info"
          showIcon
          title={tAvatar("securityNoticeTitle")}
          description={tAvatar("securityNoticeDescription")}
        />

        <Form.Item className="!mb-0 !mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="primary"
              htmlType="submit"
              icon={
                saveDisabled && !mutation.isPending ? (
                  <Lock size={14} aria-hidden="true" />
                ) : undefined
              }
              loading={mutation.isPending}
              disabled={saveDisabled}
              aria-label={t("saveAriaLabel")}
            >
              {tCommon("save")}
            </Button>
            {saveHint ? (
              <Text type="secondary" className="text-sm">
                {saveHint}
              </Text>
            ) : null}
          </div>
        </Form.Item>
      </AppCard>
    </Form>
  );
}
