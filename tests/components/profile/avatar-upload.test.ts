import { describe, expect, it, vi } from "vitest";

import {
  isOwnAvatarPath,
  removeAvatar,
} from "../../../src/components/profile/avatar-upload";

const remove = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({
  eq: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: vi.fn(() => ({
        remove,
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
