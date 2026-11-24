export type AccessErrorCode =
  | "live_disabled"
  | "live_unavailable"
  | "live_quota_exceeded"
  | "bot_detected"
  | "verification_unavailable"
  | "invalid_api_key_format"
  | "unknown_example";

/**
 * Refusals that happen before any paid call. `fallback: "demo"` tells the client
 * it can continue with a recorded example.
 */
export class AccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: AccessErrorCode,
    public readonly options: {
      fallback?: "demo";
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message);
    this.name = "AccessError";
  }
}
