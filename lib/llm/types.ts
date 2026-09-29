import type { z } from "zod";

export interface StructuredGenerationRequest<T> {
  instructions: string;
  input: unknown;
  schema: z.ZodType<T>;
}

export interface StructuredLLM {
  generate<T>(request: StructuredGenerationRequest<T>): Promise<T>;
}

export interface Providers {
  author: StructuredLLM;
  reviewer: StructuredLLM;
}
