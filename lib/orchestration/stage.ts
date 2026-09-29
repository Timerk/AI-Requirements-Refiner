import type { z } from "zod";
import { loadPrompt, type PromptName } from "@/lib/prompts/loader";
import type { StructuredLLM } from "@/lib/llm/types";
import { ProviderError, type FailureDiagnostics } from "@/lib/llm/errors";

export class PipelineError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly status = 502,
    public readonly diagnostics: FailureDiagnostics = {},
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

// Revalidate at the orchestration boundary, including when a provider is replaced in tests.
export async function runStage<T>(
  provider: StructuredLLM,
  prompt: PromptName,
  schema: z.ZodType<T>,
  input: unknown,
  validate?: (result: T) => void,
): Promise<T> {
  const started = performance.now();
  console.info("[refiner:stage]", { stage: prompt, event: "started" });
  try {
    const instructions = await loadPrompt(prompt);
    const result = schema.parse(
      await provider.generate({ instructions, input, schema }),
    );
    validate?.(result);
    console.info("[refiner:stage]", {
      stage: prompt,
      event: "completed",
      durationMs: Math.round(performance.now() - started),
    });
    return result;
  } catch (error) {
    console.error("[refiner:stage]", {
      stage: prompt,
      event: "failed",
      durationMs: Math.round(performance.now() - started),
      ...(error instanceof ProviderError
        ? error.diagnostics
        : { code: "stage_validation_or_prompt_error" }),
    });
    if (error instanceof ProviderError)
      throw new PipelineError(
        prompt,
        error.message,
        error.status,
        error.diagnostics,
      );
    throw new PipelineError(
      prompt,
      "This stage returned invalid data or could not load its prompt. Please retry; if it persists, check the server setup.",
    );
  }
}
