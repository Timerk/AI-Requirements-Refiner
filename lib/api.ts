import { z } from "zod";
import { ProviderError } from "./llm/errors";
import { PipelineError } from "./orchestration/stage";

class InputError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// Bound bytes while reading, including requests without a Content-Length header.
async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new InputError("Send a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Request body is missing.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512000) {
        await reader.cancel();
        throw new InputError(
          "Request is too large. Shorten the project description or answers.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InputError("Request body is not valid JSON.", 400);
  }
}

export async function handleRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  run: (input: T) => Promise<unknown>,
) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  console.info("[refiner:api]", {
    requestId,
    event: "started",
    path: new URL(request.url).pathname,
  });
  try {
    const input = schema.parse(await readJson(request));
    const result = await run(input);
    console.info("[refiner:api]", {
      requestId,
      event: "completed",
      durationMs: Math.round(performance.now() - started),
    });
    return Response.json(result, { headers });
  } catch (error) {
    console.error("[refiner:api]", {
      requestId,
      event: "failed",
      durationMs: Math.round(performance.now() - started),
      stage: error instanceof PipelineError ? error.stage : undefined,
      ...(error instanceof PipelineError || error instanceof ProviderError
        ? error.diagnostics
        : {
            code:
              error instanceof z.ZodError || error instanceof InputError
                ? "invalid_request"
                : "internal_error",
          }),
    });
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          requestId,
          error:
            "Check your project details and answer every required question.",
          issues: error.issues.map(({ path, message }) => ({ path, message })),
        },
        { status: 400, headers },
      );
    }
    if (error instanceof PipelineError)
      return Response.json(
        {
          error: error.message,
          stage: error.stage,
          diagnostics: error.diagnostics,
          requestId,
        },
        { status: error.status, headers },
      );
    if (error instanceof ProviderError || error instanceof InputError)
      return Response.json(
        {
          error: error.message,
          requestId,
          ...(error instanceof ProviderError
            ? { diagnostics: error.diagnostics }
            : {}),
        },
        { status: error.status, headers },
      );
    return Response.json(
      { error: "The request could not be completed. Please retry.", requestId },
      { status: 500, headers },
    );
  }
}
