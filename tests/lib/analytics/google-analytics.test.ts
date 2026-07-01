// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_ANALYTICS_EVENT_NAMES,
  type GoogleAnalyticsEventName,
  normalizeGoogleAnalyticsMeasurementId,
  sanitizeGoogleAnalyticsParams,
  trackApiRequestResult,
  trackButtonClick,
  fetchWithGoogleAnalytics,
  trackGoogleAnalyticsEvent,
  trackStudyEventInGoogleAnalytics,
} from "../../../src/lib/analytics/google-analytics";

describe("normalizeGoogleAnalyticsMeasurementId", () => {
  it("accepts GA4 measurement IDs and trims whitespace", () => {
    expect(normalizeGoogleAnalyticsMeasurementId(" G-ABC123XYZ9 ")).toBe(
      "G-ABC123XYZ9",
    );
  });

  it("rejects missing or non-GA4 IDs", () => {
    expect(normalizeGoogleAnalyticsMeasurementId(undefined)).toBeNull();
    expect(normalizeGoogleAnalyticsMeasurementId("UA-123")).toBeNull();
    expect(normalizeGoogleAnalyticsMeasurementId("G-")).toBeNull();
  });
});

describe("GOOGLE_ANALYTICS_EVENT_NAMES", () => {
  it("uses GA4-safe custom event names", () => {
    expect(GOOGLE_ANALYTICS_EVENT_NAMES).toEqual([
      "practice_started",
      "answer_submitted",
      "feedback_viewed",
      "comparison_report_viewed",
      "recommended_problem_clicked",
      "button_clicked",
      "api_request_finished",
    ]);
    for (const name of GOOGLE_ANALYTICS_EVENT_NAMES) {
      expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect(name).not.toMatch(/^(page_view|click|scroll|session_start)$/);
    }
  });
});

describe("sanitizeGoogleAnalyticsParams", () => {
  it("keeps primitive funnel parameters", () => {
    expect(
      sanitizeGoogleAnalyticsParams({
        question_no: 53,
        problem_id: "problem-1",
        char_count: 342,
        retry: true,
        optional: null,
      }),
    ).toEqual({
      question_no: 53,
      problem_id: "problem-1",
      char_count: 342,
      retry: true,
      optional: null,
    });
  });

  it("strips PII-like, GA-reserved, nested, undefined, and long values", () => {
    expect(
      sanitizeGoogleAnalyticsParams({
        user_id: "user-1",
        session_id: "session-1",
        submission_id: "submission-1",
        report_id: "report-1",
        email: "learner@example.test",
        answer_text: "raw answer",
        ga_debug: "reserved prefix",
        _internal: "reserved prefix",
        nested: { unsafe: true },
        missing: undefined,
        long_value: "x".repeat(201),
        api_name: "writing_evaluation_status",
      }),
    ).toEqual({
      api_name: "writing_evaluation_status",
    });
  });
});

describe("trackGoogleAnalyticsEvent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "gtag");
  });

  it("no-ops when measurement ID or gtag is unavailable", () => {
    expect(() =>
      trackGoogleAnalyticsEvent("practice_started", { question_no: 51 }),
    ).not.toThrow();

    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-ABC123XYZ9");
    expect(() =>
      trackGoogleAnalyticsEvent("practice_started", { question_no: 51 }),
    ).not.toThrow();
  });

  it("sends sanitized event params when GA is available", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-ABC123XYZ9");
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", {
      configurable: true,
      value: gtag,
    });

    trackGoogleAnalyticsEvent("practice_started", {
      question_no: 51,
      answer_text: "raw content",
    });

    expect(gtag).toHaveBeenCalledWith("event", "practice_started", {
      question_no: 51,
    });
  });

  it("throws in test for invalid event names", () => {
    expect(() =>
      trackGoogleAnalyticsEvent("1_invalid" as GoogleAnalyticsEventName),
    ).toThrow(/invalid GA event name/);
  });
});

describe("analytics helper events", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "gtag");
  });

  function enableGa() {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-ABC123XYZ9");
    const gtag = vi.fn();
    Object.defineProperty(window, "gtag", {
      configurable: true,
      value: gtag,
    });
    return gtag;
  }

  it("maps internal submission events to learner-facing GA events", () => {
    const gtag = enableGa();

    trackStudyEventInGoogleAnalytics({
      eventType: "submission_submitted",
      problemId: "problem-1",
      submissionId: "sub-1",
      sessionId: "session-1",
      payload: {
        question_no: 54,
        char_count: 612,
        answer_text: "raw answer",
      },
    });

    expect(gtag).toHaveBeenCalledWith("event", "answer_submitted", {
      problem_id: "problem-1",
      question_no: 54,
      char_count: 612,
    });
  });

  it("does not mirror draft autosave noise to GA", () => {
    const gtag = enableGa();

    trackStudyEventInGoogleAnalytics({
      eventType: "draft_autosaved",
      problemId: "problem-1",
      payload: { question_no: 52 },
    });

    expect(gtag).not.toHaveBeenCalled();
  });

  it("tracks stable button click and API result events", () => {
    const gtag = enableGa();

    trackButtonClick({
      buttonId: "feedback_retry",
      surface: "feedback_report",
      questionNo: 53,
      problemId: "problem-1",
    });
    trackApiRequestResult({
      apiName: "writing_evaluation_status",
      status: "success",
      statusCode: 200,
      durationMs: 42.7,
    });

    expect(gtag).toHaveBeenNthCalledWith(1, "event", "button_clicked", {
      button_id: "feedback_retry",
      surface: "feedback_report",
      question_no: 53,
      problem_id: "problem-1",
    });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "api_request_finished", {
      api_name: "writing_evaluation_status",
      api_status: "success",
      http_status: 200,
      duration_ms: 43,
    });
  });

  it("wraps fetch and tracks safe API response status without raw URLs", async () => {
    const gtag = enableGa();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await fetchWithGoogleAnalytics(
      "/api/writing/evaluation-status?submissionId=sub-1",
      { cache: "no-store" },
      { apiName: "writing_evaluation_status", fetchImpl },
    );

    expect(response.status).toBe(204);
    expect(gtag).toHaveBeenCalledWith("event", "api_request_finished", {
      api_name: "writing_evaluation_status",
      api_status: "success",
      http_status: 204,
      duration_ms: expect.any(Number),
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("submissionId");
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("sub-1");
  });

  it("wraps fetch and tracks network errors before rethrowing", async () => {
    const gtag = enableGa();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });

    await expect(
      fetchWithGoogleAnalytics("/api/practice/recommendations", undefined, {
        apiName: "practice_recommendations",
        fetchImpl,
      }),
    ).rejects.toThrow(/network down/);

    expect(gtag).toHaveBeenCalledWith("event", "api_request_finished", {
      api_name: "practice_recommendations",
      api_status: "network_error",
      duration_ms: expect.any(Number),
    });
  });
});
