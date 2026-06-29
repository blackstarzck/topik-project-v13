"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuestionNo } from "@/lib/practice/types";
import type { WritingAvailability as ServerWritingAvailability } from "@/lib/practice/writing-availability";

export type WritingAvailability = Omit<
  ServerWritingAvailability,
  "availableTypes" | "lockedTypes"
> & {
  availableTypes: Set<QuestionNo>;
  lockedTypes: Set<QuestionNo>;
};

type SerializableWritingAvailability = Omit<
  ServerWritingAvailability,
  "availableTypes" | "lockedTypes"
> & {
  availableTypes: QuestionNo[];
  lockedTypes: QuestionNo[];
};

async function queryWritingAvailability(): Promise<WritingAvailability> {
  const response = await fetch("/api/practice/writing-availability", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`writing_availability_request_failed:${response.status}`);
  }

  const raw = (await response.json()) as SerializableWritingAvailability;
  return {
    ...raw,
    availableTypes: new Set(raw.availableTypes),
    lockedTypes: new Set(raw.lockedTypes),
  };
}

export function fetchWritingAvailability() {
  return queryWritingAvailability();
}

export function writingAvailabilityKey() {
  return ["writing-availability"] as const;
}

export function useWritingAvailability() {
  return useQuery({
    queryKey: writingAvailabilityKey(),
    queryFn: fetchWritingAvailability,
    retry: false,
  });
}
