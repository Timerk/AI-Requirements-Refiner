import "server-only";
import { OpenAIProvider } from "./openai";
import { ProviderError } from "./errors";
import type { Providers } from "./types";

export function createProviders(): Providers {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderError(
      "Missing configuration: OPENAI_API_KEY. Check your .env files and restart the server. Blank entries in .env.local override values in .env.",
      503,
      { code: "missing_configuration" },
    );
  }
  const luna = new OpenAIProvider(apiKey, "gpt-5.6-luna");
  return { author: luna, reviewer: luna };
}
