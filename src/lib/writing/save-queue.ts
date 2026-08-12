export type SaveQueueStatus = "idle" | "saving" | "failed" | "disposed";

export type SaveQueueState = {
  failedRevision?: number;
  hasUnsaved: boolean;
  inFlightRevision?: number;
  lastSavedRevision: number;
  latestRevision: number;
  pendingRevision?: number;
  status: SaveQueueStatus;
};

export type SaveQueueOutcome<TResult> =
  | {
      isLatest: boolean;
      result: TResult;
      revision: number;
      status: "saved";
    }
  | { isLatest: boolean; revision: number; status: "failed" }
  | { revision: number; status: "superseded" | "disposed" };

export type SaveQueueEvent =
  | { isLatest: boolean; revision: number; status: "saved" | "failed" }
  | { revision: number; status: "superseded" | "disposed" };

export type SaveQueueIdleOutcome =
  | {
      lastSavedRevision: number;
      latestRevision: number;
      status: "idle";
    }
  | { failedRevision: number; latestRevision: number; status: "failed" }
  | { status: "disposed" };

export class SaveQueueFlushError extends Error {
  readonly code = "latest_save_failed";

  constructor() {
    super("The latest save did not complete.");
    this.name = "SaveQueueFlushError";
  }
}

type QueueRequest<TSnapshot, TResult> = {
  resolve: (outcome: SaveQueueOutcome<TResult>) => void;
  revision: number;
  settled: boolean;
  snapshot: TSnapshot;
};

type LatestOnlySaveQueueOptions<TSnapshot, TResult> = {
  onOutcome?: (outcome: SaveQueueEvent) => void;
  onStateChange?: (state: SaveQueueState) => void;
  save: (snapshot: TSnapshot) => Promise<TResult>;
};

export type LatestOnlySaveQueue<TSnapshot, TResult> = {
  awaitIdle: () => Promise<SaveQueueIdleOutcome>;
  dispose: () => void;
  flush: () => Promise<TResult>;
  getState: () => SaveQueueState;
  getUnsavedSnapshot: () => TSnapshot | undefined;
  request: (snapshot: TSnapshot) => Promise<SaveQueueOutcome<TResult>>;
  retry: () => Promise<SaveQueueOutcome<TResult> | undefined>;
};

export function createLatestOnlySaveQueue<TSnapshot, TResult>({
  onOutcome,
  onStateChange,
  save,
}: LatestOnlySaveQueueOptions<TSnapshot, TResult>): LatestOnlySaveQueue<
  TSnapshot,
  TResult
> {
  let disposed = false;
  let failedRevision: number | undefined;
  let inFlight: QueueRequest<TSnapshot, TResult> | undefined;
  let hasLastResult = false;
  let lastResult: TResult | undefined;
  let lastSavedRevision = 0;
  let latestRevision = 0;
  let pending: QueueRequest<TSnapshot, TResult> | undefined;
  let status: SaveQueueStatus = "idle";
  let unsavedSnapshot: TSnapshot | undefined;
  const idleWaiters: Array<(outcome: SaveQueueIdleOutcome) => void> = [];

  function state(): SaveQueueState {
    return {
      ...(failedRevision === undefined ? {} : { failedRevision }),
      hasUnsaved: unsavedSnapshot !== undefined,
      ...(inFlight ? { inFlightRevision: inFlight.revision } : {}),
      lastSavedRevision,
      latestRevision,
      ...(pending ? { pendingRevision: pending.revision } : {}),
      status,
    };
  }

  function emitState() {
    if (!disposed) onStateChange?.(state());
  }

  function settle(
    request: QueueRequest<TSnapshot, TResult>,
    outcome: SaveQueueOutcome<TResult>,
    emit = true,
  ) {
    if (request.settled) return;
    request.settled = true;
    request.resolve(outcome);
    if (emit && !disposed) {
      if (outcome.status === "saved") {
        onOutcome?.({
          isLatest: outcome.isLatest,
          revision: outcome.revision,
          status: outcome.status,
        });
      } else {
        onOutcome?.(outcome);
      }
    }
  }

  function idleOutcome(): SaveQueueIdleOutcome {
    if (disposed) return { status: "disposed" };
    if (status === "failed" && failedRevision !== undefined) {
      return { failedRevision, latestRevision, status: "failed" };
    }
    return { lastSavedRevision, latestRevision, status: "idle" };
  }

  function resolveIdleWaiters() {
    if (inFlight || pending) return;
    const outcome = idleOutcome();
    for (const resolve of idleWaiters.splice(0)) resolve(outcome);
  }

  function start(request: QueueRequest<TSnapshot, TResult>) {
    if (disposed) {
      settle(
        request,
        { revision: request.revision, status: "disposed" },
        false,
      );
      return;
    }
    inFlight = request;
    status = "saving";
    failedRevision = undefined;
    emitState();

    void save(request.snapshot).then(
      (result) => {
        if (disposed) return;
        inFlight = undefined;
        lastResult = result;
        hasLastResult = true;
        lastSavedRevision = request.revision;
        const isLatest = request.revision === latestRevision && !pending;
        settle(request, {
          isLatest,
          result,
          revision: request.revision,
          status: "saved",
        });
        if (pending) {
          const next = pending;
          pending = undefined;
          start(next);
          return;
        }
        unsavedSnapshot = undefined;
        status = "idle";
        emitState();
        resolveIdleWaiters();
      },
      () => {
        if (disposed) return;
        inFlight = undefined;
        const isLatest = request.revision === latestRevision && !pending;
        settle(request, {
          isLatest,
          revision: request.revision,
          status: "failed",
        });
        if (pending) {
          const next = pending;
          pending = undefined;
          start(next);
          return;
        }
        failedRevision = request.revision;
        unsavedSnapshot = request.snapshot;
        status = "failed";
        emitState();
        resolveIdleWaiters();
      },
    );
  }

  function request(snapshot: TSnapshot): Promise<SaveQueueOutcome<TResult>> {
    latestRevision += 1;
    const revision = latestRevision;
    if (disposed) {
      return Promise.resolve({ revision, status: "disposed" });
    }
    unsavedSnapshot = snapshot;
    failedRevision = undefined;

    return new Promise((resolve) => {
      const next: QueueRequest<TSnapshot, TResult> = {
        resolve,
        revision,
        settled: false,
        snapshot,
      };
      if (inFlight) {
        if (pending) {
          settle(pending, {
            revision: pending.revision,
            status: "superseded",
          });
        }
        pending = next;
        emitState();
        return;
      }
      start(next);
    });
  }

  async function retry() {
    if (disposed || unsavedSnapshot === undefined) return undefined;
    return request(unsavedSnapshot);
  }

  function awaitIdle(): Promise<SaveQueueIdleOutcome> {
    if (!inFlight && !pending) return Promise.resolve(idleOutcome());
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  async function flush(): Promise<TResult> {
    if (!inFlight && !pending && status === "failed") await retry();
    const outcome = await awaitIdle();
    if (outcome.status !== "idle" || !hasLastResult) {
      throw new SaveQueueFlushError();
    }
    return lastResult as TResult;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    status = "disposed";
    unsavedSnapshot = undefined;
    failedRevision = undefined;
    if (inFlight) {
      settle(
        inFlight,
        { revision: inFlight.revision, status: "disposed" },
        false,
      );
      inFlight = undefined;
    }
    if (pending) {
      settle(
        pending,
        { revision: pending.revision, status: "disposed" },
        false,
      );
      pending = undefined;
    }
    resolveIdleWaiters();
  }

  return {
    awaitIdle,
    dispose,
    flush,
    getState: state,
    getUnsavedSnapshot: () => unsavedSnapshot,
    request,
    retry,
  };
}
