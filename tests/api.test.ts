import { expect, it, vi } from "vitest";
import { handleRequest } from "@/lib/api";
import { IdeaSchema } from "@/lib/schemas/contracts";
import { PipelineError } from "@/lib/orchestration/stage";
import { idea } from "./fixtures";

function request(body: string, type = "application/json") {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
}

it("rejects malformed JSON, invalid fields, and unsupported content types before calling models", async () => {
  const run = vi.fn();
  expect((await handleRequest(request("{"), IdeaSchema, run)).status).toBe(400);
  expect((await handleRequest(request("{}"), IdeaSchema, run)).status).toBe(
    400,
  );
  expect(
    (await handleRequest(request("hello", "text/plain"), IdeaSchema, run))
      .status,
  ).toBe(415);
  expect(run).not.toHaveBeenCalled();
});

it("bounds request bytes even without a content-length header", async () => {
  const run = vi.fn();
  expect(
    (await handleRequest(request("x".repeat(512001)), IdeaSchema, run)).status,
  ).toBe(413);
  expect(run).not.toHaveBeenCalled();
});

it("returns the failing stage and suppresses unexpected internal error details", async () => {
  const response = await handleRequest(
    request(JSON.stringify(idea)),
    IdeaSchema,
    async () => {
      throw new PipelineError(
        "review-requirements",
        "OpenAI rate limit reached.",
        429,
      );
    },
  );
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({
    error: "OpenAI rate limit reached.",
    stage: "review-requirements",
    requestId: response.headers.get("X-Request-Id"),
  });
  const internal = await handleRequest(
    request(JSON.stringify(idea)),
    IdeaSchema,
    async () => {
      throw new Error("secret credential");
    },
  );
  expect(await internal.text()).not.toContain("secret credential");
});

it("serves valid output without caching project information", async () => {
  const response = await handleRequest(
    request(JSON.stringify(idea)),
    IdeaSchema,
    async (input) => ({ description: input.description }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ description: idea.description });
});
