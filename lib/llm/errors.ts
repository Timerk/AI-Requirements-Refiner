import { z } from "zod";

export interface FailureDiagnostics {
  provider?: string;
  model?: string;
  code?: string;
  upstreamStatus?: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public diagnostics: FailureDiagnostics = {},
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function providerFailure(
  provider: string,
  error: unknown,
  model?: string,
): ProviderError {
  const metadata = z
    .object({
      status: z.number().optional(),
      code: z.string().nullish(),
      type: z.string().nullish(),
    })
    .safeParse(error);
  const upstream = metadata.success ? metadata.data : {};
  // Only known codes are emitted. Never serialize SDK errors or their response bodies.
  const codes = [
    "credit_balance_exhausted",
    "insufficient_quota",
    "rate_limit_exceeded",
    "model_not_found",
    "invalid_api_key",
    "invalid_json_schema",
    "unsupported_parameter",
    "invalid_value",
  ];
  const code = codes.find(
    (code) =>
      code === upstream.code || code === upstream.type,
  );
  const diagnostics: FailureDiagnostics = {
    provider,
    model,
    code,
    upstreamStatus: upstream.status,
  };
  const failure = (message: string, status = 502) =>
    new ProviderError(message, status, diagnostics);
  if (error instanceof ProviderError) {
    error.diagnostics = { ...diagnostics, ...error.diagnostics };
    return error;
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return failure(
      `${provider} returned an invalid structured response. Please retry.`,
    );
  const status = upstream.status;
  if (
    code === "credit_balance_exhausted" ||
    code === "insufficient_quota"
  )
    return failure(
      `${provider} API credit or quota is exhausted. Check API billing and the budget for the project that owns this key; retrying alone will not fix this.`,
      429,
    );
  if (status === 429)
    return failure(
      `${provider} rate limit reached. Wait a moment, then retry.`,
      429,
    );
  if (status === 503)
    return failure(
      `${provider} is temporarily unavailable or overloaded. Wait a moment, then retry.`,
      503,
    );
  if (status === 401 || status === 403)
    return failure(
      `${provider} rejected the API credentials. Check the server configuration.`,
      503,
    );
  if (code === "model_not_found" || status === 404)
    return failure(
      `${provider} could not find or access the configured model. Check the model ID and your API project's model access.`,
    );
  if (status === 400)
    return failure(
      `${provider} rejected the model or request configuration. Check the configured model supports structured output.`,
      502,
    );
  if (error instanceof Error && /timeout|abort/i.test(error.name))
    return failure(`${provider} timed out. Please retry.`, 504);
  // Never expose provider response bodies, credentials, or submitted project data.
  return failure(
    `${provider} request failed. Check connectivity and API availability, then retry.`,
  );
}
