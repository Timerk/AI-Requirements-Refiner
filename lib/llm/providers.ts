import "server-only";
import { OpenAIProvider } from "./openai";
import { ProviderError, type Credentials } from "./errors";
import { LUNA_MODEL } from "./model";
import type { Providers } from "./types";

/**
 * Without options, uses the server's OPENAI_API_KEY. A visitor's own key is
 * passed in per request and lives only as long as these provider objects.
 */
export function createProviders(options?: {
  apiKey: string;
  credentials: Credentials;
}): Providers {
  const apiKey = options ? options.apiKey : process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderError(
      "Missing configuration: OPENAI_API_KEY. Check your .env files and restart the server. Blank entries in .env.local override values in .env.",
      503,
      { code: "missing_configuration" },
    );
  }
  const luna = new OpenAIProvider(
    apiKey,
    LUNA_MODEL,
    options?.credentials ?? "server",
  );
  return { author: luna, reviewer: luna };
}
