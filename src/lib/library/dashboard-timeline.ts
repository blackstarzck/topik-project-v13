// Pure timeline payload parsing. Keep this module free of queries and dashboard assembly.
import type { LibraryDashboardTimelineEventType } from "./types";

type LibraryDashboardTimelineJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: LibraryDashboardTimelineJson | undefined }
  | LibraryDashboardTimelineJson[];

/** @internal */
export type StudyEventDashboardRow = {
  id: string;
  event_type: string;
  occurred_at: string;
  problem_id: string | null;
  submission_id: string | null;
  payload: LibraryDashboardTimelineJson | null;
};

/** @internal */
export type ComparisonReportDashboardRow = {
  id: string;
  current_submission_id: string;
};

/** @internal */
export type ExportFileDashboardRow = {
  id: string;
  source_type: "submission" | "report" | "library_selection";
  source_id: string | null;
};

/** @internal */
export type TimelineSubmissionRow = {
  id: string;
  problem_id: string;
  question_no: number;
  history_title?: string | null;
};

export type LibraryDashboardTimelineLookups = {
  comparisonReportsById?: ReadonlyMap<string, ComparisonReportDashboardRow>;
  exportFilesById?: ReadonlyMap<string, ExportFileDashboardRow>;
};

export type ParsedLibraryDashboardTimelineEvent = {
  eventType: LibraryDashboardTimelineEventType;
  submissionId: string | null;
  payloadProblemId: string | null;
  payloadQuestionNo: number | null;
  exportId: string | null;
  reportId: string | null;
  directSubmissionId: string | null;
  resolvedPayloadSubmissionId: string | null;
  directReportId: string | null;
  sourceReportId: string | null;
};

export const TIMELINE_EVENT_TYPES = [
  "submission_submitted",
  "feedback_viewed",
  "report_viewed",
  "export_downloaded",
] as const satisfies readonly LibraryDashboardTimelineEventType[];

export function parseLibraryDashboardTimelineEvent(
  event: StudyEventDashboardRow,
  {
    comparisonReportsById = new Map(),
    exportFilesById = new Map(),
  }: LibraryDashboardTimelineLookups = {},
): ParsedLibraryDashboardTimelineEvent | null {
  if (!isTimelineEventType(event.event_type)) return null;

  const directSubmissionId = event.submission_id;
  const payloadSubmissionId = payloadString(event.payload, "submission_id");
  const payloadProblemId = payloadString(event.payload, "problem_id");
  const payloadQuestionNo = payloadNumber(event.payload, "question_no");
  const exportId = payloadString(event.payload, "export_id");
  const directReportId =
    event.event_type === "report_viewed"
      ? payloadString(event.payload, "report_id")
      : null;
  const directSource = payloadSource(event.payload);
  const sourceReportId =
    directSource?.sourceType === "report" ? directSource.sourceId : null;

  let resolvedPayloadSubmissionId = payloadSubmissionId;
  let reportId = directReportId;

  if (!resolvedPayloadSubmissionId && event.event_type === "report_viewed") {
    resolvedPayloadSubmissionId = directReportId
      ? (comparisonReportsById.get(directReportId)?.current_submission_id ??
        null)
      : null;
  }

  if (
    !resolvedPayloadSubmissionId &&
    event.event_type === "export_downloaded"
  ) {
    const source =
      directSource ??
      (() => {
        const file = exportId ? exportFilesById.get(exportId) : null;
        if (!file?.source_id) return null;
        return { sourceType: file.source_type, sourceId: file.source_id };
      })();

    if (source?.sourceType === "submission") {
      resolvedPayloadSubmissionId = source.sourceId;
    } else if (source?.sourceType === "report") {
      reportId = source.sourceId;
      resolvedPayloadSubmissionId =
        comparisonReportsById.get(source.sourceId)?.current_submission_id ??
        null;
    }
  }

  return {
    eventType: event.event_type,
    submissionId: directSubmissionId ?? resolvedPayloadSubmissionId,
    payloadProblemId,
    payloadQuestionNo,
    exportId,
    reportId,
    directSubmissionId,
    resolvedPayloadSubmissionId,
    directReportId,
    sourceReportId,
  };
}

function isTimelineEventType(
  eventType: string | null,
): eventType is LibraryDashboardTimelineEventType {
  return TIMELINE_EVENT_TYPES.includes(
    eventType as LibraryDashboardTimelineEventType,
  );
}

function payloadString(
  payload: LibraryDashboardTimelineJson | null,
  key: string,
): string | null {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function payloadNumber(
  payload: LibraryDashboardTimelineJson | null,
  key: string,
): number | null {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function payloadSource(payload: LibraryDashboardTimelineJson | null): {
  sourceType: ExportFileDashboardRow["source_type"];
  sourceId: string;
} | null {
  const sourceType = payloadString(payload, "source_type");
  const sourceId = payloadString(payload, "source_id");
  if (
    (sourceType === "submission" ||
      sourceType === "report" ||
      sourceType === "library_selection") &&
    sourceId
  ) {
    return { sourceType, sourceId };
  }
  return null;
}
