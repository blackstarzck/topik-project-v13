"use client";

/**
 * X-05 avatar upload helper (avatars storage bucket).
 *
 * Bucket policy (20260520121300_storage_policies.sql):
 *   - path convention: avatars/{user_id}/{file}
 *   - owner select/insert/update/delete to own folder; private bucket.
 *   - bucket limit 5MB, mime png/jpeg/webp.
 *
 * We enforce 5MB + jpg/png client-side (spec says jpg/png; webp is also bucket-
 * allowed but the spec lists jpg/png, so we accept the two documented types).
 * `avatar_path` on profiles stores the object path. The browser resolves it
 * through a short-lived signed URL under the current user's Storage RLS.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;
export const AVATAR_SIGNED_URL_TTL_SECONDS = 5 * 60;

// i18n: 이 모듈은 컴포넌트가 아니라 useTranslations를 쓸 수 없다(wave-2/3 key-expose
// 패턴). 사용자에게 보이는 메시지는 profile.avatar.* 카탈로그 키로 노출하고, 렌더
// 컴포넌트(ProfileForm)가 t()로 해석한다. 여기서는 메시지 키만 보관/전달한다.
export type AvatarValidationError =
  | { ok: true }
  | { ok: false; reason: "size" | "type"; messageKey: string };

export function validateAvatarFile(file: File): AvatarValidationError {
  if (
    !AVATAR_ALLOWED_TYPES.includes(
      file.type as (typeof AVATAR_ALLOWED_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      reason: "type",
      messageKey: "invalidType",
    };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      reason: "size",
      messageKey: "tooLarge",
    };
  }
  return { ok: true };
}

/**
 * i18n: squareCropImage 내부 실패는 컴포넌트가 카탈로그로 해석할 수 있도록
 * profile.avatar.* 키를 `messageKey`에 담아 던진다(throw). 컴포넌트의 catch가
 * 이 키를 우선 해석하고, 키가 없으면 기본 업로드 실패 문구로 대체한다.
 */
export class AvatarError extends Error {
  readonly messageKey: string;
  constructor(messageKey: string) {
    super(messageKey);
    this.name = "AvatarError";
    this.messageKey = messageKey;
  }
}

function extensionFor(file: File): "png" | "jpg" {
  return file.type === "image/png" ? "png" : "jpg";
}

export type AvatarUploadResult = {
  path: string;
};

export function isOwnAvatarPath(userId: string, path: string | null): boolean {
  return typeof path === "string" && path.startsWith(`${userId}/`);
}

/**
 * Upload a (square-cropped) avatar blob to avatars/{userId}/avatar-<ts>.<ext>,
 * persist the path to profiles.avatar_path, and return the stored path.
 * The rendering consumer resolves that path through `avatarSignedUrl`.
 */
export async function uploadAvatar(
  userId: string,
  file: Blob,
  ext: "png" | "jpg",
): Promise<AvatarUploadResult> {
  const supabase = createSupabaseBrowserClient();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: ext === "png" ? "image/png" : "image/jpeg",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);

  return { path };
}

export async function avatarSignedUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function removeAvatar(
  userId: string,
  currentPath: string | null,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const removablePath = isOwnAvatarPath(userId, currentPath)
    ? currentPath
    : null;
  if (removablePath) {
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove([removablePath]);
    if (removeError) throw new Error(removeError.message);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);
}

export { extensionFor };

/**
 * Square-crop a source image File to a centered square and re-encode as
 * jpeg/png via canvas. Returns the cropped Blob + chosen extension. Falls back
 * to the original file when running without a DOM (SSR/test) — callers should
 * only invoke this in the browser.
 */
export async function squareCropImage(
  file: File,
  size = 256,
): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
  const ext = extensionFor(file);
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    return { blob: file, ext };
  }
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, ext };
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new AvatarError("convertFailed"))),
      mime,
      0.9,
    );
  });
  return { blob, ext };
}
