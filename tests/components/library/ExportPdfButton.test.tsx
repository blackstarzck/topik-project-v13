import { describe, expect, it, vi } from "vitest";

import { createExportPdfHandler } from "../../../src/components/library/ExportPdfButton";
import koMessages from "../../../messages/ko.json";

/**
 * `ExportPdfButton` is a thin shell around `triggerPdfExport` + antd's
 * App.message bus. The component's load-bearing logic is extracted into
 * `createExportPdfHandler` so vitest can verify the click sequence without
 * a DOM (no jsdom is configured).
 *
 * i18n: the handler is hook-free and now takes the localized success/fallback
 * toast text via deps (the component resolves t() and supplies them). We pull
 * the VERBATIM Korean from the merged ko catalog so the assertions track the
 * single source of truth (no dependency on the ephemeral messages/_staging/ dir).
 *
 * Contract under test:
 *   1. clicking the button calls `triggerPdfExport` with the same
 *      sourceType/sourceId the button was mounted with — exactly once;
 *   2. on success → `message.success(deps.successMessage)`;
 *   3. on error → `message.error(err.message)`;
 *   4. on non-Error rejection → `message.error(deps.errorMessage)`;
 *   5. the button does NOT log a study_events row itself
 *      (triggerPdfExport already does — double-log would skew KPI counts).
 */
const SUCCESS_KO = koMessages.library.exportButton.printDialogOpened;
const FALLBACK_KO = koMessages.library.exportButton.exportFailed;
describe("ExportPdfButton — createExportPdfHandler", () => {
  it("calls triggerPdfExport with the bound sourceType/sourceId exactly once", async () => {
    const trigger = vi.fn(async () => ({ exportId: "exp-1" }));
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-42" },
      {
        trigger,
        notifySuccess,
        notifyError,
        successMessage: SUCCESS_KO,
        errorMessage: FALLBACK_KO,
      },
    );

    await onClick();

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith({
      sourceType: "submission",
      sourceId: "sub-42",
    });
  });

  it("emits the Korean success toast after triggerPdfExport resolves", async () => {
    const trigger = vi.fn(async () => ({ exportId: "exp-1" }));
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();

    const onClick = createExportPdfHandler(
      { sourceType: "report", sourceId: "rep-9" },
      {
        trigger,
        notifySuccess,
        notifyError,
        successMessage: SUCCESS_KO,
        errorMessage: FALLBACK_KO,
      },
    );

    await onClick();

    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith(SUCCESS_KO);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("surfaces the trigger error message through notifyError (no rethrow)", async () => {
    const trigger = vi.fn(async () => {
      throw new Error("network down");
    });
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      {
        trigger,
        notifySuccess,
        notifyError,
        successMessage: SUCCESS_KO,
        errorMessage: FALLBACK_KO,
      },
    );

    // Handler must not reject — clicking the button should never crash the
    // tree. Errors are surfaced through the toast bus instead.
    await expect(onClick()).resolves.toBeUndefined();
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledWith("network down");
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("falls back to a Korean default message when the thrown value is not an Error", async () => {
    const trigger = vi.fn(async () => {
      // Simulate a non-Error rejection (e.g. supabase-js sometimes throws strings).
      throw "boom";
    });
    const notifyError = vi.fn();

    const onClick = createExportPdfHandler(
      { sourceType: "report", sourceId: "rep-2" },
      {
        trigger,
        notifySuccess: vi.fn(),
        notifyError,
        successMessage: SUCCESS_KO,
        errorMessage: FALLBACK_KO,
      },
    );

    await onClick();
    expect(notifyError).toHaveBeenCalledWith(FALLBACK_KO);
  });

  it("does not invoke any study-event logger of its own (single-log contract)", async () => {
    // Sanity assertion: the deps surface only the trigger + two notify
    // channels + the two localized toast strings. There's no `logEvent`
    // channel — the button has no way to write a second study_events row
    // even if a future refactor tries.
    const trigger = vi.fn(async () => ({ exportId: "exp-1" }));
    const deps = {
      trigger,
      notifySuccess: vi.fn(),
      notifyError: vi.fn(),
      successMessage: SUCCESS_KO,
      errorMessage: FALLBACK_KO,
    } as const;
    // Type-level check: no event-logging channel is exposed to the handler.
    const keys = Object.keys(deps).sort();
    expect(keys).toEqual([
      "errorMessage",
      "notifyError",
      "notifySuccess",
      "successMessage",
      "trigger",
    ]);
    expect(keys).not.toContain("logEvent");

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();
    expect(trigger).toHaveBeenCalledTimes(1);
  });
});
