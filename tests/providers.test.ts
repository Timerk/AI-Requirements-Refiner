import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenAIProvider } from "@/lib/llm/openai";
import { createProviders } from "@/lib/llm/providers";

const { parse } = vi.hoisted(() => ({
  parse: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
});
const request = {
  instructions: "Return the value.",
  input: { idea: "Test" },
  schema: z.object({ value: z.string() }),
};

it("uses Luna for author and reviewer with only an OpenAI key", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "old-model");
  try {
    parse.mockResolvedValue({
      status: "completed",
      output_parsed: { value: "ok" },
    });
    const providers = createProviders();
    await providers.author.generate(request);
    await providers.reviewer.generate(request);
    expect(parse).toHaveBeenCalledTimes(2);
    for (const [args] of parse.mock.calls) {
      expect(args.model).toBe("gpt-5.6-luna");
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

it("uses OpenAI structured output with server configuration and storage disabled", async () => {
  parse.mockResolvedValue({
    status: "completed",
    output_parsed: { value: "ok" },
  });
  expect(
    await new OpenAIProvider("test-key", "configured-author").generate(request),
  ).toEqual({ value: "ok" });
  expect(parse).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "configured-author",
      store: false,
      instructions: request.instructions,
      input: JSON.stringify(request.input),
      text: {
        format: expect.objectContaining({ type: "json_schema", strict: true }),
      },
    }),
  );
});

it("rejects OpenAI refusals, incomplete responses, invalid shapes, and rate limits", async () => {
  const provider = new OpenAIProvider("test-key", "configured-author");
  for (const response of [
    { status: "completed", output_parsed: null },
    { status: "incomplete", output_parsed: { value: "partial" } },
    { status: "completed", output_parsed: { value: 42 } },
  ]) {
    parse.mockResolvedValueOnce(response);
    await expect(provider.generate(request)).rejects.toMatchObject({
      name: "ProviderError",
      status: 502,
    });
  }
  parse.mockRejectedValueOnce({
    status: 429,
    message: "Sensitive vendor response",
  });
  await expect(provider.generate(request)).rejects.toMatchObject({
    status: 429,
    message: "OpenAI rate limit reached. Wait a moment, then retry.",
  });
});
