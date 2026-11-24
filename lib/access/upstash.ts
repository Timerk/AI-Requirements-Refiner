import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  QuotaUnavailableError,
  type QuotaDecision,
  type QuotaStore,
} from "./quota";

export class UpstashQuotaStore implements QuotaStore {
  private readonly redis: Redis;
  private readonly limiters = new Map<number, Ratelimit>();

  constructor(config: { url: string; token: string }) {
    this.redis = new Redis({ ...config, retry: { retries: 1 } });
  }

  private limiter(limit: number) {
    let limiter = this.limiters.get(limit);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        // Fixed windows of one day are aligned to the Unix epoch, i.e. 00:00 UTC.
        limiter: Ratelimit.fixedWindow(limit, "1 d"),
        prefix: "refiner:live",
        analytics: false,
        timeout: 3000,
      });
      this.limiters.set(limit, limiter);
    }
    return limiter;
  }

  async consume(key: string, limit: number): Promise<QuotaDecision> {
    let result: Awaited<ReturnType<Ratelimit["limit"]>>;
    try {
      result = await this.limiter(limit).limit(key);
    } catch {
      // Never surface Redis error details; they can include the REST URL.
      throw new QuotaUnavailableError();
    }
    // On timeout the library reports success ("fail open"). A paid call must
    // never depend on that, so treat it as an undecidable quota.
    if (result.reason === "timeout") throw new QuotaUnavailableError();
    return { allowed: result.success, resetAt: result.reset };
  }
}
