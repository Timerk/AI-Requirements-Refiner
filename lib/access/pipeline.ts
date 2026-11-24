import { z } from "zod";
import { handleRequest } from "@/lib/api";
import { findDemoExample, type DemoExample } from "@/lib/demo/examples";
import type { Credentials } from "@/lib/llm/errors";
import type { Providers } from "@/lib/llm/types";
import { hostedLiveAvailable, type AccessConfig } from "./config";
import { AccessError } from "./errors";
import {
  consumeLiveRun,
  type PipelineRoute,
  type QuotaStore,
} from "./quota";
import { readVisitorKey, visitorId } from "./visitor";

/** Without an explicit `mode`, requests are served from recordings. */
export const RunOptionsSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  exampleId: z.string().max(64).optional(),
});

export interface AccessDependencies {
  config: AccessConfig;
  quotaStore: () => QuotaStore | undefined;
  /** Resolves false for bots and throws when verification is unavailable. */
  verifyHuman: () => Promise<boolean>;
  createProviders: (apiKey: string, credentials: Credentials) => Providers;
  now?: () => number;
}

export interface PipelineRouteDefinition<T> {
  route: PipelineRoute;
  schema: z.ZodType<T>;
  recorded: (example: DemoExample) => object;
  live: (input: T, providers: Providers) => Promise<object>;
}

const DEMO_HINT = "You can still walk through a recorded example.";

/**
 * Every paid call passes, in order: kill switch, key format check, bot check,
 * then either the visitor's own key or the hosted daily quota. Input limits
 * are enforced earlier by handleRequest for every mode.
 */
async function authorizeLive(
  request: Request,
  route: PipelineRoute,
  deps: AccessDependencies,
): Promise<Providers> {
  const { config } = deps;
  if (config.demoOnly)
    throw new AccessError(
      `Live runs are switched off on this deployment right now. ${DEMO_HINT}`,
      503,
      "live_disabled",
      { fallback: "demo" },
    );
  const visitorKey = readVisitorKey(request);
  if (visitorKey.kind === "malformed")
    throw new AccessError(
      "That does not look like an OpenAI API key. Keys start with “sk-”. Check the key, or remove it to use the shared daily runs.",
      400,
      "invalid_api_key_format",
    );
  let human: boolean;
  try {
    human = await deps.verifyHuman();
  } catch {
    throw new AccessError(
      `The automated browser check is unavailable, so live runs are paused. ${DEMO_HINT}`,
      503,
      "verification_unavailable",
      { fallback: "demo" },
    );
  }
  if (!human)
    throw new AccessError(
      `This request did not pass the automated browser check. Reload the page and retry. ${DEMO_HINT}`,
      403,
      "bot_detected",
      { fallback: "demo" },
    );
  // The visitor pays for their own key, so it bypasses the hosted quota.
  if (visitorKey.kind === "valid")
    return deps.createProviders(visitorKey.apiKey, "visitor");

  const unavailable = (reason: string) =>
    new AccessError(
      `${reason} ${DEMO_HINT} You can also add your own OpenAI API key.`,
      503,
      "live_unavailable",
      { fallback: "demo" },
    );
  const store = hostedLiveAvailable(config) ? deps.quotaStore() : undefined;
  if (!store || !config.serverApiKey)
    throw unavailable(
      "Live runs with the hosted key are not available on this deployment.",
    );
  const now = deps.now?.() ?? Date.now();
  let decision: Awaited<ReturnType<typeof consumeLiveRun>>;
  try {
    decision = await consumeLiveRun(
      store,
      { route, visitor: visitorId(request) },
      config.limits,
      now,
    );
  } catch {
    // Fail closed: without a working counter there is no hosted live run.
    throw unavailable("The usage limiter cannot be reached, so live runs are paused.");
  }
  if (!decision.allowed)
    throw new AccessError(
      decision.scope === "visitor"
        ? `You have used today's ${config.limits.perIp} free live ${config.limits.perIp === 1 ? "run" : "runs"}. The limit resets at 00:00 UTC. ${DEMO_HINT} You can also add your own OpenAI API key to keep going live.`
        : `Today's shared live runs are used up. They reset at 00:00 UTC. ${DEMO_HINT} You can also add your own OpenAI API key to keep going live.`,
      429,
      "live_quota_exceeded",
      {
        fallback: "demo",
        retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - now) / 1000)),
      },
    );
  return deps.createProviders(config.serverApiKey, "server");
}

export function handlePipelineRequest<T>(
  request: Request,
  definition: PipelineRouteDefinition<T>,
  deps: AccessDependencies,
) {
  return handleRequest(request, definition.schema, async (input, body) => {
    const options = RunOptionsSchema.parse(body);
    if (options.mode === "demo") {
      const example = findDemoExample(options.exampleId);
      if (!example)
        throw new AccessError(
          "Choose one of the recorded examples.",
          400,
          "unknown_example",
        );
      return {
        ...definition.recorded(example),
        source: "recorded",
        exampleId: example.id,
      };
    }
    const providers = await authorizeLive(request, definition.route, deps);
    return { ...(await definition.live(input, providers)), source: "live" };
  });
}
