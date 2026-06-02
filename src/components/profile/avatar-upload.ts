"use client";

/**
 * X-05 avatar upload helper (avatars storage bucket).
 *
 * Bucket policy (20260520121300_storage_policies.sql):
 *   - path convention: avatars/{user_id}/{file}
 *   - owner insert/update/delete to own folder; public read.
 *   - bucket limit 5MB, mime png/jpeg/webp.
 *
 * We enforce 5MB + jpg/png client-side (spec says jpg/png; webp is also bucket-
 * allowed but the spec lists jpg/png, so we accept the two documented types).
 * `avatar_path` on profiles stores the object path so the public URL can be
 * derived anywhere. This is a REAL upload — Supabase Storage is wired here, not
 * an external provider stub.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;

export type AvatarValidationError =
  | { ok: true }
  | { ok: false; reason: "size" | "type"; message: string };

export function validateAvatarFile(file: File): AvatarValidationError {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    return {
      ok: false,
      reason: "type",
      message: "JPG 또는 PNG 이미지만 올릴 수 있어요.",
    };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: "이미지 크기는 5MB 이하여야 해요.",
    };
  }
  return { ok: true };
}

function extensionFor(file: File): "png" | "jpg" {
  return file.type === "image/png" ? "png" : "jpg";
}

export type AvatarUploadResult = {
  path: string;
  publicUrl: string;
};

/**
 * Upload a (square-cropped) avatar blob to avatars/{userId}/avatar-<ts>.<ext>,
 * persist the path to profiles.avatar_path, and return the public URL.
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

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);

  return { path, publicUrl: urlData.publicUrl };
}

export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const supabase = createSupabaseBrowserClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
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
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
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
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했어요."))),
      mime,
      0.9,
    );
  });
  return { blob, ext };
}
