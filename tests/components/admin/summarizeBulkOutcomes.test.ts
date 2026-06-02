// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import {
  summarizeBulkOutcomes,
  type BulkOutcome,
} from "../../../src/components/admin/AdminUsersConsole";

// AdminUsersConsole is a "use client" module that imports antd at load time.
// antd's reset styling probes matchMedia/ResizeObserver on import in jsdom;
// stub them so the module evaluates cleanly. (We only exercise the pure helper.)
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof window.ResizeObserver === "undefined") {
    class RO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  }
});

/**
 * X-10 region 6 — bulk action result aggregation.
 *
 * `summarizeBulkOutcomes` is the pure partition that drives the success toast
 * and the failed-row list ("일괄 처리 실패/권한 충돌은 실패 행 목록으로 안내").
 * It must never swallow a failure and must default a missing reason to a
 * friendly Korean string.
 */
describe("summarizeBulkOutcomes", () => {
  it("counts all-success with an empty failed list", () => {
    const outcomes: BulkOutcome[] = [
      { id: "a", name: "김민지", ok: true },
      { id: "b", name: "박서준", ok: true },
    ];
    const { succeeded, failed } = summarizeBulkOutcomes(outcomes);
    expect(succeeded).toBe(2);
    expect(failed).toEqual([]);
  });

  it("partitions a mixed batch and preserves failure reasons", () => {
    const outcomes: BulkOutcome[] = [
      { id: "a", name: "김민지", ok: true },
      { id: "b", name: "박서준", ok: false, reason: "본인 계정은 변경할 수 없습니다" },
      { id: "c", name: "이수민", ok: true },
    ];
    const { succeeded, failed } = summarizeBulkOutcomes(outcomes);
    expect(succeeded).toBe(2);
    expect(failed).toEqual([
      { id: "b", name: "박서준", reason: "본인 계정은 변경할 수 없습니다" },
    ]);
  });

  it("defaults a missing/blank reason to a friendly Korean string", () => {
    const outcomes: BulkOutcome[] = [
      { id: "a", name: "김민지", ok: false },
      { id: "b", name: "박서준", ok: false, reason: "   " },
    ];
    const { succeeded, failed } = summarizeBulkOutcomes(outcomes);
    expect(succeeded).toBe(0);
    expect(failed).toHaveLength(2);
    expect(failed.every((f) => f.reason === "알 수 없는 오류")).toBe(true);
  });

  it("returns zeros for an empty batch", () => {
    const { succeeded, failed } = summarizeBulkOutcomes([]);
    expect(succeeded).toBe(0);
    expect(failed).toEqual([]);
  });
});
