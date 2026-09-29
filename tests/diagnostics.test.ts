import { expect, it, vi } from "vitest";
import { providerFailure } from "@/lib/llm/errors";
import { createProviders } from "@/lib/llm/providers";

vi.mock("server-only", () => ({}));

it("names missing settings and explains blank local overrides without exposing configured values", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_MODEL", "author");
  try {
    expect(createProviders).toThrow(/Missing configuration: OPENAI_API_KEY\./);
    expect(createProviders).toThrow(/Blank entries in .env.local override/);
    expect(createProviders).not.toThrow(/private-configured-key/);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("distinguishes depleted API credit from temporary throttling", () => {
  const failure = providerFailure("OpenAI", {
    status: 429,
    code: "credit_balance_exhausted",
    type: "insufficient_quota",
    message: "Private vendor content must not be logged or returned",
  });
  expect(failure.message).toMatch(/credit|billing/i);
  expect(failure.message).not.toContain("Wait a moment");
  expect(failure.message).not.toContain("Private vendor content");
});

it("also recognizes the insufficient_quota error code", () => {
  expect(
    providerFailure("OpenAI", { status: 429, code: "insufficient_quota" })
      .message,
  ).toMatch(/credit|billing/i);
});

it("continues to recommend retry for a temporary rate limit", () => {
  expect(
    providerFailure("OpenAI", { status: 429, code: "rate_limit_exceeded" })
      .message,
  ).toContain("Wait a moment");
});

it("identifies temporary provider unavailability", () => {
  const error = providerFailure("OpenAI", { status: 503 });
  expect(error.status).toBe(503);
  expect(error.message).toMatch(/overloaded|unavailable/);
});

it("retains safe diagnostics without exposing arbitrary vendor messages or codes", () => {
  const error = providerFailure(
    "OpenAI",
    {
      status: 400,
      code: "secret-key-value",
      message: "private project text",
      headers: { authorization: "secret-key-value" },
    },
    "configured-model",
  );
  expect(error.diagnostics).toEqual({
    provider: "OpenAI",
    model: "configured-model",
    upstreamStatus: 400,
    code: undefined,
  });
  expect(JSON.stringify(error)).not.toContain("secret-key-value");
  expect(JSON.stringify(error)).not.toContain("private project text");
});
