import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { StructuredGenerationRequest, StructuredLLM } from "./types";
import { ProviderError, providerFailure } from "./errors";

export class OpenAIProvider implements StructuredLLM {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, timeout: 90000, maxRetries: 0 });
  }

  async generate<T>({
    instructions,
    input,
    schema,
  }: StructuredGenerationRequest<T>): Promise<T> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions,
        input: JSON.stringify(input),
        text: { format: zodTextFormat(schema, "result") },
        store: false,
      });
      if (response.status !== "completed" || response.output_parsed === null) {
        throw new ProviderError(
          "OpenAI did not return a complete structured response. It may have refused or reached an output limit.",
        );
      }
      const parsed = schema.safeParse(response.output_parsed);
      if (!parsed.success)
        throw new ProviderError(
          "OpenAI returned an invalid structured response. Please retry.",
        );
      return parsed.data;
    } catch (error) {
      throw providerFailure("OpenAI", error, this.model);
    }
  }
}
