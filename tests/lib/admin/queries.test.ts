import { describe, expect, it } from "vitest";
import {
  adminProblemsKey,
  adminUsersKey,
} from "../../../src/lib/admin/queries";

describe("admin query keys", () => {
  describe("adminUsersKey", () => {
    it("is stable when called with no filter (idempotent)", () => {
      const a = adminUsersKey();
      const b = adminUsersKey();
      expect(a).toEqual(b);
      expect(a).toEqual(["admin-users", { search: "", role: "" }]);
    });

    it("is stable for the same filter (deep-equal)", () => {
      const a = adminUsersKey({ search: "kim", role: "content_admin" });
      const b = adminUsersKey({ search: "kim", role: "content_admin" });
      expect(a).toEqual(b);
    });

    it("normalizes whitespace in search to make keys stable", () => {
      expect(adminUsersKey({ search: "  kim  " })).toEqual(
        adminUsersKey({ search: "kim" }),
      );
    });

    it("treats missing role and explicit undefined as the same key", () => {
      expect(adminUsersKey({ role: undefined })).toEqual(adminUsersKey({}));
    });

    it("produces a different key for a different role", () => {
      expect(
        adminUsersKey({ role: "platform_admin" }),
      ).not.toEqual(adminUsersKey({ role: "content_admin" }));
    });
  });

  describe("adminProblemsKey", () => {
    it("is stable when called with no filter (idempotent)", () => {
      const a = adminProblemsKey();
      const b = adminProblemsKey();
      expect(a).toEqual(b);
      expect(a).toEqual(["admin-problems", { status: "" }]);
    });

    it("is stable for the same status filter", () => {
      const a = adminProblemsKey({ status: "draft" });
      const b = adminProblemsKey({ status: "draft" });
      expect(a).toEqual(b);
    });

    it("produces a different key per publish status", () => {
      expect(
        adminProblemsKey({ status: "published" }),
      ).not.toEqual(adminProblemsKey({ status: "archived" }));
    });

    it("treats missing status and explicit undefined as the same key", () => {
      expect(adminProblemsKey({ status: undefined })).toEqual(
        adminProblemsKey({}),
      );
    });
  });
});
