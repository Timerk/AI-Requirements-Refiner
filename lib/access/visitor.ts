import { createHash } from "node:crypto";

export const VISITOR_KEY_HEADER = "x-openai-key";

/**
 * On Vercel, x-real-ip and x-forwarded-for are set by the platform and cannot be
 * spoofed by the client. Elsewhere (local development) they are only hints.
 */
export function clientIp(request: Request) {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/** Quota keys never contain the raw IP address. */
export function visitorId(request: Request) {
  return createHash("sha256")
    .update(`requirements-refiner:${clientIp(request)}`)
    .digest("hex")
    .slice(0, 32);
}

const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,300}$/;

export type VisitorKey =
  | { kind: "none" }
  | { kind: "valid"; apiKey: string }
  | { kind: "malformed" };

/** Reads the visitor's own OpenAI key. The value is used for this request only. */
export function readVisitorKey(request: Request): VisitorKey {
  const raw = request.headers.get(VISITOR_KEY_HEADER);
  if (raw === null || raw.trim() === "") return { kind: "none" };
  const apiKey = raw.trim();
  return KEY_PATTERN.test(apiKey) ? { kind: "valid", apiKey } : { kind: "malformed" };
}
