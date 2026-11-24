export type QuotaBackend = "upstash" | "memory" | "unavailable";

export interface AccessConfig {
  /** Kill switch: no paid call of any kind (hosted key or visitor key). */
  demoOnly: boolean;
  serverApiKey?: string;
  limits: { perIp: number; global: number };
  quotaBackend: QuotaBackend;
  upstash?: { url: string; token: string };
  onVercel: boolean;
}

/** What the browser may know about the deployment. Never contains secrets. */
export interface PublicAccess {
  hostedLive: boolean;
  visitorKey: boolean;
  demoOnly: boolean;
  perIpLimit: number;
}

type Env = Record<string, string | undefined>;

export const DEFAULT_RUNS_PER_IP_PER_DAY = 3;
export const DEFAULT_RUNS_GLOBAL_PER_DAY = 30;

// A kill switch should fail safe: anything other than an explicit "off" value enables it.
function parseDemoOnly(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return !["false", "0", "no", "off"].includes(normalized);
}

// Invalid limits fall back to the conservative defaults; 0 disables hosted live runs.
function parseLimit(value: string | undefined, fallback: number) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (!/^\d{1,6}$/.test(normalized)) return fallback;
  return Number(normalized);
}

export function readAccessConfig(env: Env = process.env): AccessConfig {
  const url = (env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL)?.trim();
  const token = (env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN)?.trim();
  const onVercel = env.VERCEL === "1";
  const upstash = url && token ? { url, token } : undefined;
  return {
    demoOnly: parseDemoOnly(env.DEMO_ONLY),
    serverApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    limits: {
      perIp: parseLimit(env.LIVE_RUNS_PER_IP_PER_DAY, DEFAULT_RUNS_PER_IP_PER_DAY),
      global: parseLimit(
        env.LIVE_RUNS_GLOBAL_PER_DAY,
        DEFAULT_RUNS_GLOBAL_PER_DAY,
      ),
    },
    // Serverless instances do not share memory, so an in-memory counter would not
    // limit anything on Vercel. Without Redis there, hosted live runs stay off.
    quotaBackend: upstash ? "upstash" : onVercel ? "unavailable" : "memory",
    upstash,
    onVercel,
  };
}

export function hostedLiveAvailable(config: AccessConfig) {
  return (
    !config.demoOnly &&
    Boolean(config.serverApiKey) &&
    config.quotaBackend !== "unavailable" &&
    config.limits.perIp > 0 &&
    config.limits.global > 0
  );
}

export function publicAccess(config: AccessConfig): PublicAccess {
  return {
    hostedLive: hostedLiveAvailable(config),
    visitorKey: !config.demoOnly,
    demoOnly: config.demoOnly,
    perIpLimit: config.limits.perIp,
  };
}
