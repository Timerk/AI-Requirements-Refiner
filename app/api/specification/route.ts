import { handleRequest } from "@/lib/api";
import { createProviders } from "@/lib/llm/providers";
import { generateSpecification } from "@/lib/orchestration/generateSpecification";
import { SpecificationInputSchema } from "@/lib/schemas/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleRequest(request, SpecificationInputSchema, (input) =>
    generateSpecification(input, createProviders()),
  );
}
