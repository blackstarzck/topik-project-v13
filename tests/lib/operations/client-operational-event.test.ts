import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  CLIENT_OPERATIONAL_EVENT_CODES,
  CLIENT_OPERATIONAL_EVENT_FEATURES,
  CLIENT_OPERATIONAL_EVENT_OPERATIONS,
  CLIENT_OPERATIONAL_EVENT_RESULTS,
  createClientOperationalEvent,
  emitClientOperationalEvent,
  sanitizeClientOperationalAppVersion,
  type ClientOperationalEvent,
  validateClientOperationalEvent,
} from "../../../src/lib/operations/client-operational-event";

const CORRELATION_ID = "2f1d4b86-44cf-4d66-8a23-2d1bf847c21a";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function validEvent(
  overrides: Partial<ClientOperationalEvent> = {},
): ClientOperationalEvent {
  return {
    code: "unavailable_shown",
    feature: "legal_terms",
    operation: "load",
    result: "failure",
    correlationId: CORRELATION_ID,
    ...overrides,
  };
}

describe("ClientOperationalEvent allowlist", () => {
  it("exposes only the stable event catalogs", () => {
    expect(CLIENT_OPERATIONAL_EVENT_CODES).toEqual([
      "unavailable_shown",
      "retry_requested",
      "recovery_cleanup_finished",
      "operation_failed",
    ]);
    expect(CLIENT_OPERATIONAL_EVENT_FEATURES).toEqual([
      "legal_terms",
      "legal_privacy",
      "landing_profile",
      "practice_problem_list",
      "library_resource",
      "client_recovery",
      "notification_inbox",
      "profile_settings",
      "pdf_export",
    ]);
    expect(CLIENT_OPERATIONAL_EVENT_OPERATIONS).toEqual([
      "load",
      "retry",
      "clear_for_logout",
      "clear_for_account_deletion",
      "save",
      "delete",
      "download",
      "mark_read",
      "mark_all_read",
    ]);
    expect(CLIENT_OPERATIONAL_EVENT_RESULTS).toEqual([
      "success",
      "failure",
      "skipped",
    ]);
  });

  it("has no user content or identity fields in its public type", () => {
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("id");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("userId");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("profile");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("profileId");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("email");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("answer");
    expectTypeOf<ClientOperationalEvent>().not.toHaveProperty("body");
  });

  it("accepts allowlisted values and bounded numeric measurements", () => {
    const event = validEvent({
      latencyMs: 86_400_000,
      count: 1_000_000,
      retryCount: 100,
      appVersion: "v13.2026-07-18+sha.a1b2c3",
    });

    expect(validateClientOperationalEvent(event)).toEqual({
      ok: true,
      event,
    });
  });

  it.each([
    ["code", "raw_error"],
    ["feature", "profile_user_123"],
    ["operation", "select_database"],
    ["result", "error: timeout"],
  ])("rejects a non-allowlisted %s", (key, value) => {
    expect(
      validateClientOperationalEvent({
        ...validEvent(),
        [key]: value,
      }),
    ).toEqual({ ok: false, reason: "invalid_event" });
  });

  it.each([
    ["latencyMs", -1],
    ["latencyMs", 86_400_001],
    ["latencyMs", 1.1],
    ["latencyMs", Number.NaN],
    ["count", -1],
    ["count", 1_000_001],
    ["retryCount", -1],
    ["retryCount", 101],
  ])("rejects an out-of-range %s", (key, value) => {
    expect(
      validateClientOperationalEvent({
        ...validEvent(),
        [key]: value,
      }),
    ).toEqual({ ok: false, reason: "invalid_event" });
  });
});

describe("ClientOperationalEvent runtime privacy checks", () => {
  it.each([
    "id",
    "userId",
    "profile",
    "profileId",
    "email",
    "answer",
    "answerText",
    "body",
    "content",
    "token",
    "authorization",
    "stack",
    "url",
    "error",
  ])("rejects the extra field %s", (key) => {
    expect(
      validateClientOperationalEvent({
        ...validEvent(),
        [key]: "must-never-leave-the-client",
      }),
    ).toEqual({ ok: false, reason: "invalid_event" });
  });

  it.each([
    "learner@example.test",
    "Bearer abc.def.ghi",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature123",
    "https://example.test/callback?code=secret",
    "oauth?code=secret&code_challenge=challenge",
    "SELECT email FROM profiles",
    "database_connection_failed",
    "raw-error-stack",
    "Error: timeout at saveDraft",
    "x".repeat(65),
  ])("rejects a dangerous appVersion value without echoing it: %s", (value) => {
    expect(sanitizeClientOperationalAppVersion(value)).toBeNull();
    expect(
      validateClientOperationalEvent(validEvent({ appVersion: value })),
    ).toEqual({ ok: false, reason: "invalid_event" });
  });

  it("rejects unknown object shapes without returning their values", () => {
    const raw = "private-answer-that-must-not-be-echoed";
    const result = validateClientOperationalEvent({ answer: raw });

    expect(result).toEqual({ ok: false, reason: "invalid_event" });
    expect(JSON.stringify(result)).not.toContain(raw);
  });
});

describe("createClientOperationalEvent", () => {
  it("creates only a fresh random UUID correlation ID and sanitizes appVersion", () => {
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce(CORRELATION_ID)
      .mockReturnValueOnce("4af79c34-ff6c-4adb-a16c-b9fb1e506c2a");
    vi.stubGlobal("crypto", { randomUUID });

    const first = createClientOperationalEvent({
      code: "retry_requested",
      feature: "landing_profile",
      operation: "retry",
      result: "success",
      appVersion: "  v13.2.0+sha.abc123  ",
    });
    const second = createClientOperationalEvent({
      code: "retry_requested",
      feature: "landing_profile",
      operation: "retry",
      result: "success",
    });

    expect(first).toEqual({
      ok: true,
      event: {
        code: "retry_requested",
        feature: "landing_profile",
        operation: "retry",
        result: "success",
        correlationId: CORRELATION_ID,
        appVersion: "v13.2.0+sha.abc123",
      },
    });
    expect(second).toEqual({
      ok: true,
      event: {
        code: "retry_requested",
        feature: "landing_profile",
        operation: "retry",
        result: "success",
        correlationId: "4af79c34-ff6c-4adb-a16c-b9fb1e506c2a",
      },
    });
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });

  it("fails closed when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(
      createClientOperationalEvent({
        code: "unavailable_shown",
        feature: "library_resource",
        operation: "load",
        result: "failure",
      }),
    ).toEqual({ ok: false, reason: "correlation_unavailable" });
  });
});

describe("emitClientOperationalEvent", () => {
  it("uses an injected sink and returns a typed emitted result", async () => {
    const sink = vi.fn();
    const event = validEvent();

    await expect(emitClientOperationalEvent(event, sink)).resolves.toEqual({
      ok: true,
      status: "emitted",
    });
    expect(sink).toHaveBeenCalledWith(event);
  });

  it("delivers allowlisted events through the authenticated same-origin boundary by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(emitClientOperationalEvent(validEvent())).resolves.toEqual({
      ok: true,
      status: "emitted",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/client-operational-events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(validEvent()),
        credentials: "same-origin",
        keepalive: true,
      }),
    );
  });

  it("does not throw or log payload values when a sink fails", async () => {
    const raw = "private sink failure with learner@example.test";
    const sink = vi.fn(async () => {
      throw new Error(raw);
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await emitClientOperationalEvent(validEvent(), sink);

    expect(result).toEqual({
      ok: false,
      status: "failed",
      reason: "sink_failed",
    });
    expect(JSON.stringify(result)).not.toContain(raw);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("rejects invalid events before invoking the sink", async () => {
    const sink = vi.fn();
    const invalidEvent = {
      ...validEvent(),
      answer: "private answer",
    } as unknown as ClientOperationalEvent;

    await expect(
      emitClientOperationalEvent(invalidEvent, sink),
    ).resolves.toEqual({
      ok: false,
      status: "rejected",
      reason: "invalid_event",
    });
    expect(sink).not.toHaveBeenCalled();
  });
});
