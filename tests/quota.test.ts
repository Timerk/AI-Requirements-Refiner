import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hostedLiveAvailable,
  publicAccess,
  readAccessConfig,
} from "@/lib/access/config";
import {
  consumeLiveRun,
  DAY_MS,
  MemoryQuotaStore,
  QuotaUnavailableError,
  type QuotaStore,
} from "@/lib/access/quota";
import { readVisitorKey, visitorId } from "@/lib/access/visitor";

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow = vi.fn(() => "fixed-window");
    limit = limit;
  },
}));
beforeEach(() => limit.mockReset());

const NOW = Date.UTC(2026, 10, 24, 23, 59, 0);

describe("consumeLiveRun", () => {
  it("checks the visitor counter before the global counter, per route", async () => {
    const consume = vi.fn(async () => ({ allowed: true, resetAt: 0 }));
    const decision = await consumeLiveRun(
      { consume },
      { route: "analyze", visitor: "v1" },
      { perIp: 3, global: 30 },
      NOW,
    );
    expect(decision).toEqual({ allowed: true });
    expect(consume.mock.calls).toEqual([
      ["visitor:analyze:v1", 3],
      ["global:analyze", 30],
    ]);
  });

  it("does not touch the global counter when the visitor is over the limit", async () => {
    const consume = vi.fn(async () => ({ allowed: false, resetAt: 42 }));
    expect(
      await consumeLiveRun(
        { consume },
        { route: "specification", visitor: "v1" },
        { perIp: 3, global: 30 },
        NOW,
      ),
    ).toEqual({ allowed: false, scope: "visitor", resetAt: 42 });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("reports the global scope when only the global cap is reached", async () => {
    const store: QuotaStore = {
      consume: async (key) => ({ allowed: key.startsWith("visitor"), resetAt: 7 }),
    };
    expect(
      await consumeLiveRun(
        store,
        { route: "analyze", visitor: "v1" },
        { perIp: 3, global: 30 },
        NOW,
      ),
    ).toEqual({ allowed: false, scope: "global", resetAt: 7 });
  });

  it("treats a limit of 0 as disabled without calling the store", async () => {
    const consume = vi.fn();
    const decision = await consumeLiveRun(
      { consume },
      { route: "analyze", visitor: "v1" },
      { perIp: 0, global: 30 },
      NOW,
    );
    expect(decision).toMatchObject({ allowed: false, scope: "visitor" });
    expect(consume).not.toHaveBeenCalled();
  });
});

describe("MemoryQuotaStore", () => {
  it("counts per key and resets at 00:00 UTC", async () => {
    let now = NOW;
    const store = new MemoryQuotaStore(() => now);
    const results = [];
    for (let i = 0; i < 3; i++) results.push((await store.consume("k", 2)).allowed);
    expect(results).toEqual([true, true, false]);
    expect((await store.consume("other", 2)).allowed).toBe(true);
    expect((await store.consume("k", 2)).resetAt).toBe(
      Date.UTC(2026, 10, 25),
    );
    now += 60_000; // 00:00:00 UTC next day
    expect((await store.consume("k", 2)).allowed).toBe(true);
  });
});

describe("UpstashQuotaStore", () => {
  async function store() {
    const { UpstashQuotaStore } = await import("@/lib/access/upstash");
    return new UpstashQuotaStore({ url: "https://example.upstash.io", token: "t" });
  }

  it("maps the limiter result", async () => {
    limit.mockResolvedValueOnce({ success: true, reset: NOW + DAY_MS });
    limit.mockResolvedValueOnce({ success: false, reset: NOW + DAY_MS });
    const quota = await store();
    expect(await quota.consume("k", 3)).toEqual({
      allowed: true,
      resetAt: NOW + DAY_MS,
    });
    expect((await quota.consume("k", 3)).allowed).toBe(false);
    expect(limit).toHaveBeenCalledWith("k");
  });

  it("fails closed on the library's fail-open timeout and on Redis errors", async () => {
    const quota = await store();
    limit.mockResolvedValueOnce({ success: true, reset: 0, reason: "timeout" });
    await expect(quota.consume("k", 3)).rejects.toBeInstanceOf(
      QuotaUnavailableError,
    );
    limit.mockRejectedValueOnce(new Error("https://example.upstash.io 401"));
    const failure = quota.consume("k", 3);
    await expect(failure).rejects.toBeInstanceOf(QuotaUnavailableError);
    await expect(failure).rejects.not.toThrow(/upstash\.io/);
  });
});

describe("configuration", () => {
  it("uses conservative defaults and an in-memory store outside Vercel", () => {
    const config = readAccessConfig({ OPENAI_API_KEY: " sk-test " });
    expect(config).toMatchObject({
      demoOnly: false,
      serverApiKey: "sk-test",
      limits: { perIp: 3, global: 30 },
      quotaBackend: "memory",
    });
    expect(hostedLiveAvailable(config)).toBe(true);
  });

  it("treats any DEMO_ONLY value except an explicit off value as on", () => {
    for (const value of ["true", "1", "TRUE", "yes", "ture"])
      expect(readAccessConfig({ DEMO_ONLY: value }).demoOnly).toBe(true);
    for (const value of ["", "false", "0", "no", "OFF", undefined])
      expect(readAccessConfig({ DEMO_ONLY: value }).demoOnly).toBe(false);
    const config = readAccessConfig({ DEMO_ONLY: "true", OPENAI_API_KEY: "k" });
    expect(publicAccess(config)).toEqual({
      hostedLive: false,
      visitorKey: false,
      demoOnly: true,
      perIpLimit: 3,
    });
  });

  it("parses limits and falls back to defaults for invalid values", () => {
    expect(
      readAccessConfig({
        LIVE_RUNS_PER_IP_PER_DAY: "5",
        LIVE_RUNS_GLOBAL_PER_DAY: "0",
      }).limits,
    ).toEqual({ perIp: 5, global: 0 });
    expect(
      readAccessConfig({
        LIVE_RUNS_PER_IP_PER_DAY: "-1",
        LIVE_RUNS_GLOBAL_PER_DAY: "lots",
      }).limits,
    ).toEqual({ perIp: 3, global: 30 });
  });

  it("requires Redis on Vercel and accepts Vercel KV variable names", () => {
    const vercel = readAccessConfig({ VERCEL: "1", OPENAI_API_KEY: "k" });
    expect(vercel.quotaBackend).toBe("unavailable");
    expect(hostedLiveAvailable(vercel)).toBe(false);
    expect(publicAccess(vercel).visitorKey).toBe(true);
    expect(
      readAccessConfig({
        VERCEL: "1",
        KV_REST_API_URL: "https://kv.example",
        KV_REST_API_TOKEN: "token",
      }),
    ).toMatchObject({
      quotaBackend: "upstash",
      upstash: { url: "https://kv.example", token: "token" },
    });
  });

  it("never exposes secrets in the public access summary", () => {
    const summary = JSON.stringify(
      publicAccess(
        readAccessConfig({
          OPENAI_API_KEY: "sk-very-secret",
          UPSTASH_REDIS_REST_TOKEN: "upstash-secret",
          UPSTASH_REDIS_REST_URL: "https://db.example",
        }),
      ),
    );
    expect(summary).not.toMatch(/secret|db\.example/);
  });
});

describe("visitor identity and keys", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("http://localhost/api/analyze", { headers });

  it("hashes the client IP instead of storing it", () => {
    const id = visitorId(withHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(id).not.toContain("203.0.113.7");
    expect(visitorId(withHeaders({ "x-real-ip": "203.0.113.7" }))).toBe(id);
    expect(visitorId(withHeaders({ "x-real-ip": "203.0.113.8" }))).not.toBe(id);
  });

  it("accepts only plausible OpenAI keys", () => {
    expect(readVisitorKey(withHeaders({}))).toEqual({ kind: "none" });
    expect(readVisitorKey(withHeaders({ "x-openai-key": "  " }))).toEqual({
      kind: "none",
    });
    expect(
      readVisitorKey(
        withHeaders({ "x-openai-key": " sk-proj-abcdefghijklmnopqrstuvwxyz " }),
      ),
    ).toEqual({ kind: "valid", apiKey: "sk-proj-abcdefghijklmnopqrstuvwxyz" });
    for (const value of ["sk-short", "pk-abcdefghijklmnopqrstuvwxyz", "sk-abc def ghi jkl mno pqr"])
      expect(readVisitorKey(withHeaders({ "x-openai-key": value })).kind).toBe(
        "malformed",
      );
  });
});
