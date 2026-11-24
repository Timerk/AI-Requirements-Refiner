import "server-only";
import { checkBotId } from "botid/server";
import { createProviders } from "@/lib/llm/providers";
import { readAccessConfig } from "./config";
import type { AccessDependencies } from "./pipeline";
import { MemoryQuotaStore, type QuotaStore } from "./quota";
import { UpstashQuotaStore } from "./upstash";

let memoryStore: MemoryQuotaStore | undefined;
let upstashStore: UpstashQuotaStore | undefined;

export function serverAccessDependencies(): AccessDependencies {
  const config = readAccessConfig();
  return {
    config,
    quotaStore(): QuotaStore | undefined {
      if (config.quotaBackend === "upstash" && config.upstash)
        return (upstashStore ??= new UpstashQuotaStore(config.upstash));
      if (config.quotaBackend === "memory")
        return (memoryStore ??= new MemoryQuotaStore());
      return undefined;
    },
    async verifyHuman() {
      // BotID classifies requests only on Vercel deployments. Local development
      // and self-hosted servers have no bot check; see the README.
      if (!config.onVercel) return true;
      const verification = await checkBotId();
      return !verification.isBot;
    },
    createProviders: (apiKey, credentials) =>
      createProviders({ apiKey, credentials }),
  };
}
