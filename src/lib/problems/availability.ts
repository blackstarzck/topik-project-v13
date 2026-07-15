export type ProblemPublishStatus = "draft" | "published" | "archived";
export type ProblemVisibility = "private" | "public" | "org";
export type ProblemLifecycleStatus = "active" | "inactive" | "expired";

export type ProblemAvailabilityState =
  | "available"
  | "soft_unavailable"
  | "hard_unavailable";

export type ProblemAvailabilityInput = {
  publishStatus: ProblemPublishStatus | string | null | undefined;
  visibility: ProblemVisibility | string | null | undefined;
  lifecycleStatus: ProblemLifecycleStatus | string | null | undefined;
  lifecycleReason: string | null | undefined;
  submitBlockedReason?: string | null | undefined;
};

export type ProblemAvailability = {
  state: ProblemAvailabilityState;
  canShowProblemIdentity: boolean;
  canStart: boolean;
  canSubmit: boolean;
  labelKey: "providedEnded" | null;
  reason: string | null;
};

export function getProblemAvailability(
  input: ProblemAvailabilityInput | null,
): ProblemAvailability {
  if (!input) {
    return {
      state: "hard_unavailable",
      canShowProblemIdentity: false,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: null,
    };
  }

  const published = input.publishStatus === "published";
  const publicVisible = input.visibility === "public";
  const active = input.lifecycleStatus === "active";

  if (published && publicVisible && active && input.submitBlockedReason) {
    return {
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: null,
      reason: input.submitBlockedReason,
    };
  }

  if (published && publicVisible && active) {
    return {
      state: "available",
      canShowProblemIdentity: true,
      canStart: true,
      canSubmit: true,
      labelKey: null,
      reason: null,
    };
  }

  if (published && publicVisible) {
    return {
      state: "soft_unavailable",
      canShowProblemIdentity: true,
      canStart: false,
      canSubmit: false,
      labelKey: "providedEnded",
      reason: input.lifecycleReason ?? null,
    };
  }

  return {
    state: "hard_unavailable",
    canShowProblemIdentity: false,
    canStart: false,
    canSubmit: false,
    labelKey: "providedEnded",
    reason: null,
  };
}
