export const DAY_MS = 24 * 60 * 60 * 1000;

export type PipelineRoute = "analyze" | "specification";

export interface QuotaDecision {
  allowed: boolean;
  /** Epoch milliseconds when the current window ends. */
  resetAt: number;
}

/**
 * Counts uses of `key` in fixed daily windows aligned to 00:00 UTC.
 * Implementations throw QuotaUnavailableError when they cannot decide;
 * callers must then refuse the paid call (fail closed).
 */
export interface QuotaStore {
  consume(key: string, limit: number): Promise<QuotaDecision>;
}

export class QuotaUnavailableError extends Error {
  constructor(message = "The quota store could not be reached.") {
    super(message);
    this.name = "QuotaUnavailableError";
  }
}

export type LiveRunDecision =
  | { allowed: true }
  | { allowed: false; scope: "visitor" | "global"; resetAt: number };

/**
 * One full pipeline run is one analysis plus one specification request. Each
 * route has its own daily counter, so "3 runs per visitor" allows three of each.
 * The visitor counter is checked first so a single heavy visitor cannot drain
 * the global budget.
 */
export async function consumeLiveRun(
  store: QuotaStore,
  { route, visitor }: { route: PipelineRoute; visitor: string },
  limits: { perIp: number; global: number },
  now = Date.now(),
): Promise<LiveRunDecision> {
  const nextWindow = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
  if (limits.perIp <= 0)
    return { allowed: false, scope: "visitor", resetAt: nextWindow };
  if (limits.global <= 0)
    return { allowed: false, scope: "global", resetAt: nextWindow };
  const own = await store.consume(`visitor:${route}:${visitor}`, limits.perIp);
  if (!own.allowed)
    return { allowed: false, scope: "visitor", resetAt: own.resetAt };
  const global = await store.consume(`global:${route}`, limits.global);
  if (!global.allowed)
    return { allowed: false, scope: "global", resetAt: global.resetAt };
  return { allowed: true };
}

/** For local development only: a single Node process, counters reset on restart. */
export class MemoryQuotaStore implements QuotaStore {
  private readonly counters = new Map<string, { window: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(key: string, limit: number): Promise<QuotaDecision> {
    const window = Math.floor(this.now() / DAY_MS);
    const resetAt = (window + 1) * DAY_MS;
    const current = this.counters.get(key);
    const count = current?.window === window ? current.count : 0;
    if (count >= limit) return { allowed: false, resetAt };
    this.counters.set(key, { window, count: count + 1 });
    return { allowed: true, resetAt };
  }
}
