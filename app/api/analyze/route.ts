import { handleRequest } from "@/lib/api";
import { createProviders } from "@/lib/llm/providers";
import { analyzeProject } from "@/lib/orchestration/analyzeProject";
import { IdeaSchema } from "@/lib/schemas/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleRequest(request, IdeaSchema, (input) =>
    analyzeProject(input, createProviders()),
  );
}
