import { afterEach, describe, expect, it, vi } from "vitest";
import { readAccessConfig, type AccessConfig } from "@/lib/access/config";
import {
  handlePipelineRequest,
  type AccessDependencies,
  type PipelineRouteDefinition,
} from "@/lib/access/pipeline";
import {
  DAY_MS,
  MemoryQuotaStore,
  QuotaUnavailableError,
  type QuotaStore,
} from "@/lib/access/quota";
import { VISITOR_KEY_HEADER } from "@/lib/access/visitor";
import { providerFailure } from "@/lib/llm/errors";
import type { Providers } from "@/lib/llm/types";
import { analyzeProject } from "@/lib/orchestration/analyzeProject";
import { generateSpecification } from "@/lib/orchestration/generateSpecification";
import { IdeaSchema, SpecificationInputSchema } from "@/lib/schemas/contracts";
import { readingListExample } from "@/lib/demo/examples/readingList";
import { idea, specificationInput } from "./fixtures";

const VISITOR_KEY = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWx1234567890";
const SERVER_KEY = "sk-server-ZyXwVuTsRqPoNmLkJiHg0987654321";
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);

const analyzeRoute: PipelineRouteDefinition<typeof idea> = {
  route: "analyze",
  schema: IdeaSchema,
  recorded: (example) => example.analysis,
  live: (input, providers) => analyzeProject(input, providers),
};
const specificationRoute: PipelineRouteDefinition<typeof specificationInput> = {
  route: "specification",
  schema: SpecificationInputSchema,
  recorded: (example) => example.specification,
  live: (input, providers) => generateSpecification(input, providers),
};

function config(overrides: Partial<AccessConfig> = {}): AccessConfig {
  return {
    ...readAccessConfig({}),
    serverApiKey: SERVER_KEY,
    quotaBackend: "memory",
    ...overrides,
  };
}

/** Providers that answer each stage with the matching reading-list recording. */
function scriptedProviders(): Providers {
  const outputs: unknown[] = [
    readingListExample.analysis.analysis,
    readingListExample.analysis.review,
    readingListExample.specification.draft,
    readingListExample.specification.review,
    {
      specification: readingListExample.specification.finalSpecification,
      reviewDecisions: readingListExample.specification.reviewDecisions,
    },
  ];
  const llm = {
    generate: vi.fn(async ({ schema }) =>
      schema.parse(outputs.find((output) => schema.safeParse(output).success)),
    ),
  };
  return { author: llm, reviewer: llm };
}

function dependencies(
  overrides: Partial<AccessDependencies> = {},
): AccessDependencies & {
  createProviders: ReturnType<typeof vi.fn>;
  verifyHuman: ReturnType<typeof vi.fn>;
} {
  const store = new MemoryQuotaStore(() => NOW);
  return {
    config: config(),
    quotaStore: () => store,
    verifyHuman: vi.fn(async () => true),
    createProviders: vi.fn(() => scriptedProviders()),
    now: () => NOW,
    ...overrides,
  } as never;
}

function request(
  body: unknown,
  {
    key,
    ip = "203.0.113.7",
    path = "analyze",
  }: { key?: string; ip?: string; path?: string } = {},
) {
  return new Request(`http://localhost/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...(key ? { [VISITOR_KEY_HEADER]: key } : {}),
    },
    body: JSON.stringify(body),
  });
}
const live = (body: object = idea) => ({ ...body, mode: "live" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("demo mode", () => {
  it("serves the recorded example without touching providers, quota, or bot checks", async () => {
    const quotaStore = vi.fn();
    const deps = dependencies({ quotaStore });
    const response = await handlePipelineRequest(
      request({ ...readingListExample.idea, mode: "demo", exampleId: "reading-list" }),
      analyzeRoute,
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...readingListExample.analysis,
      source: "recorded",
      exampleId: "reading-list",
    });
    expect(deps.createProviders).not.toHaveBeenCalled();
    expect(deps.verifyHuman).not.toHaveBeenCalled();
    expect(quotaStore).not.toHaveBeenCalled();
  });

  it("defaults to demo mode when no mode is sent", async () => {
    const deps = dependencies();
    const response = await handlePipelineRequest(
      request(
        { ...specificationInput, exampleId: "reading-list" },
        { path: "specification" },
      ),
      specificationRoute,
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "recorded" });
    expect(deps.createProviders).not.toHaveBeenCalled();
  });

  it("rejects unknown examples and still enforces input limits", async () => {
    const deps = dependencies();
    const unknown = await handlePipelineRequest(
      request({ ...idea, mode: "demo", exampleId: "nope" }),
      analyzeRoute,
      deps,
    );
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ code: "unknown_example" });
    const tooLong = await handlePipelineRequest(
      request({
        description: "x".repeat(12001),
        complexity: "prototype",
        mode: "demo",
        exampleId: "reading-list",
      }),
      analyzeRoute,
      deps,
    );
    expect(tooLong.status).toBe(400);
    expect(deps.createProviders).not.toHaveBeenCalled();
  });
});

describe("kill switch", () => {
  it("DEMO_ONLY refuses every live request, including visitor keys, before any paid call", async () => {
    const quotaStore = vi.fn();
    const deps = dependencies({
      config: config({ demoOnly: true }),
      quotaStore,
    });
    for (const key of [undefined, VISITOR_KEY]) {
      const response = await handlePipelineRequest(
        request(live(), { key }),
        analyzeRoute,
        deps,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "live_disabled",
        fallback: "demo",
      });
    }
    expect(deps.createProviders).not.toHaveBeenCalled();
    expect(deps.verifyHuman).not.toHaveBeenCalled();
    expect(quotaStore).not.toHaveBeenCalled();
  });
});

describe("hosted live runs", () => {
  it("uses the server key for a verified visitor within quota", async () => {
    const deps = dependencies();
    const response = await handlePipelineRequest(
      request(live()),
      analyzeRoute,
      deps,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("live");
    expect(body.questions).toEqual(readingListExample.analysis.questions);
    expect(deps.verifyHuman).toHaveBeenCalledTimes(1);
    expect(deps.createProviders).toHaveBeenCalledWith(SERVER_KEY, "server");
  });

  it("returns 429 with a demo fallback after the per-visitor limit and keeps other visitors working", async () => {
    const deps = dependencies({
      config: config({ limits: { perIp: 3, global: 30 } }),
    });
    for (let run = 0; run < 3; run++) {
      const ok = await handlePipelineRequest(
        request(live()),
        analyzeRoute,
        deps,
      );
      expect(ok.status).toBe(200);
    }
    const limited = await handlePipelineRequest(
      request(live()),
      analyzeRoute,
      deps,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe(String(12 * 60 * 60));
    expect(await limited.json()).toMatchObject({
      code: "live_quota_exceeded",
      fallback: "demo",
      error: expect.stringMatching(/today's 3 free live runs/),
    });
    expect(deps.createProviders).toHaveBeenCalledTimes(3);

    // Separate counters per route: the specification step of a run still works.
    const specification = await handlePipelineRequest(
      request(live(specificationInput), { path: "specification" }),
      specificationRoute,
      deps,
    );
    expect(specification.status).toBe(200);
    const other = await handlePipelineRequest(
      request(live(), { ip: "198.51.100.20" }),
      analyzeRoute,
      deps,
    );
    expect(other.status).toBe(200);
  });

  it("enforces the global daily cap across visitors", async () => {
    const deps = dependencies({
      config: config({ limits: { perIp: 3, global: 2 } }),
    });
    const statuses = [];
    for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) {
      statuses.push(
        (await handlePipelineRequest(request(live(), { ip }), analyzeRoute, deps))
          .status,
      );
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it("does not consume quota for invalid input or failed bot checks", async () => {
    const consume = vi.fn(async () => ({ allowed: true, resetAt: NOW + DAY_MS }));
    const store: QuotaStore = { consume };
    const invalid = await handlePipelineRequest(
      request(live({ description: "short", complexity: "prototype" })),
      analyzeRoute,
      dependencies({ quotaStore: () => store }),
    );
    expect(invalid.status).toBe(400);
    const botDeps = dependencies({
      quotaStore: () => store,
      verifyHuman: vi.fn(async () => false),
    });
    const bot = await handlePipelineRequest(request(live()), analyzeRoute, botDeps);
    expect(bot.status).toBe(403);
    expect(await bot.json()).toMatchObject({
      code: "bot_detected",
      fallback: "demo",
    });
    expect(consume).not.toHaveBeenCalled();
    expect(botDeps.createProviders).not.toHaveBeenCalled();
  });

  it("fails closed when the bot check or the quota store is unavailable", async () => {
    const verification = await handlePipelineRequest(
      request(live()),
      analyzeRoute,
      dependencies({
        verifyHuman: vi.fn(async () => {
          throw new Error("VERCEL_OIDC_TOKEN is not set");
        }),
      }),
    );
    expect(verification.status).toBe(503);
    expect(await verification.json()).toMatchObject({
      code: "verification_unavailable",
      fallback: "demo",
    });

    const broken: QuotaStore = {
      consume: async () => {
        throw new QuotaUnavailableError("https://secret.upstash.io token=abc");
      },
    };
    const deps = dependencies({ quotaStore: () => broken });
    const quota = await handlePipelineRequest(request(live()), analyzeRoute, deps);
    expect(quota.status).toBe(503);
    const text = await quota.text();
    expect(text).toContain("live_unavailable");
    expect(text).not.toContain("upstash.io");
    expect(deps.createProviders).not.toHaveBeenCalled();
  });

  it("keeps hosted live runs off without a server key or a shared quota store", async () => {
    for (const overrides of [
      { serverApiKey: undefined },
      { quotaBackend: "unavailable" as const },
      { limits: { perIp: 0, global: 30 } },
    ]) {
      const deps = dependencies({ config: config(overrides) });
      const response = await handlePipelineRequest(
        request(live()),
        analyzeRoute,
        deps,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "live_unavailable",
        fallback: "demo",
      });
      expect(deps.createProviders).not.toHaveBeenCalled();
    }
  });
});

describe("bring your own key", () => {
  it("uses the visitor key for that request only and bypasses the hosted quota", async () => {
    const consume = vi.fn();
    const deps = dependencies({
      config: config({ serverApiKey: undefined, quotaBackend: "unavailable" }),
      quotaStore: () => ({ consume }),
    });
    const logs = [
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
    ];
    for (let run = 0; run < 5; run++) {
      const response = await handlePipelineRequest(
        request(live(), { key: VISITOR_KEY }),
        analyzeRoute,
        deps,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain(VISITOR_KEY);
    }
    expect(deps.createProviders).toHaveBeenCalledWith(VISITOR_KEY, "visitor");
    expect(deps.verifyHuman).toHaveBeenCalledTimes(5);
    expect(consume).not.toHaveBeenCalled();
    for (const log of logs)
      expect(JSON.stringify(log.mock.calls)).not.toContain(VISITOR_KEY);
  });

  it("never logs or returns the key when the provider fails", async () => {
    const logs = [
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
    const failing = {
      generate: vi.fn(async () => {
        throw providerFailure(
          "OpenAI",
          {
            status: 401,
            code: "invalid_api_key",
            message: `Incorrect API key provided: ${VISITOR_KEY}`,
          },
          "gpt-6-luna",
          "visitor",
        );
      }),
    };
    const deps = dependencies({
      createProviders: vi.fn(() => ({ author: failing, reviewer: failing })),
    });
    const response = await handlePipelineRequest(
      request(live(), { key: VISITOR_KEY }),
      analyzeRoute,
      deps,
    );
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toContain("rejected the API key you entered");
    expect(text).not.toContain(VISITOR_KEY);
    expect(text).not.toContain("Incorrect API key");
    for (const log of logs)
      expect(JSON.stringify(log.mock.calls)).not.toContain(VISITOR_KEY);
  });

  it("rejects malformed keys without echoing them", async () => {
    const deps = dependencies();
    const malformed = "not-a-key with spaces <script>";
    const response = await handlePipelineRequest(
      request(live(), { key: malformed }),
      analyzeRoute,
      deps,
    );
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("invalid_api_key_format");
    expect(text).not.toContain(malformed);
    expect(deps.createProviders).not.toHaveBeenCalled();
  });

  it("ignores a key sent with a demo request", async () => {
    const deps = dependencies();
    const response = await handlePipelineRequest(
      request(
        { ...readingListExample.idea, mode: "demo", exampleId: "reading-list" },
        { key: VISITOR_KEY },
      ),
      analyzeRoute,
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(VISITOR_KEY);
    expect(deps.createProviders).not.toHaveBeenCalled();
  });
});
