import { describe, expect, it, vi } from "vitest";

import {
  AVATAR_SIGNED_URL_TTL_SECONDS,
  avatarSignedUrl,
  isOwnAvatarPath,
  removeAvatar,
  uploadAvatar,
} from "../../../src/components/profile/avatar-upload";

const remove = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ error: null }));
const createSignedUrl = vi.fn(async () => ({
  data: { signedUrl: "https://storage.example/signed-avatar" },
  error: null,
}));
const update = vi.fn(() => ({
  eq: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl,
        remove,
        upload,
      })),
    },
    from: vi.fn(() => ({
      update,
    })),
  }),
}));

describe("avatar upload helpers", () => {
  it("recognizes only paths under the user's avatar folder", () => {
    expect(isOwnAvatarPath("user-1", "user-1/avatar.png")).toBe(true);
    expect(isOwnAvatarPath("user-1", "user-2/avatar.png")).toBe(false);
    expect(isOwnAvatarPath("user-1", null)).toBe(false);
  });

  it("resolves avatar paths through a short-lived signed URL", async () => {
    createSignedUrl.mockClear();

    await expect(avatarSignedUrl("user-1/avatar.png")).resolves.toBe(
      "https://storage.example/signed-avatar",
    );
    expect(createSignedUrl).toHaveBeenCalledWith(
      "user-1/avatar.png",
      AVATAR_SIGNED_URL_TTL_SECONDS,
    );
  });

  it("returns only the stored path and leaves signed URL resolution to consumers", async () => {
    upload.mockClear();
    createSignedUrl.mockClear();
    update.mockClear();

    const result = await uploadAvatar(
      "user-1",
      new Blob(["avatar"], { type: "image/png" }),
      "png",
    );

    expect(upload).toHaveBeenCalledOnce();
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: expect.stringMatching(/^user-1\/avatar-\d+\.png$/),
    });
  });

  it("removes owned storage object and clears the profile path", async () => {
    remove.mockClear();
    update.mockClear();

    await removeAvatar("user-1", "user-1/avatar.png");

    expect(remove).toHaveBeenCalledWith(["user-1/avatar.png"]);
    expect(update).toHaveBeenCalledWith({ avatar_path: null });
  });

  it("does not remove storage objects outside the user's folder", async () => {
    remove.mockClear();
    update.mockClear();

    await removeAvatar("user-1", "user-2/avatar.png");

    expect(remove).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ avatar_path: null });
  });
});
