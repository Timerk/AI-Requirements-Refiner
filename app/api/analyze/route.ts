import { handlePipelineRequest } from "@/lib/access/pipeline";
import { serverAccessDependencies } from "@/lib/access/server";
import { analyzeProject } from "@/lib/orchestration/analyzeProject";
import { IdeaSchema } from "@/lib/schemas/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handlePipelineRequest(
    request,
    {
      route: "analyze",
      schema: IdeaSchema,
      recorded: (example) => example.analysis,
      live: (input, providers) => analyzeProject(input, providers),
    },
    serverAccessDependencies(),
  );
}
