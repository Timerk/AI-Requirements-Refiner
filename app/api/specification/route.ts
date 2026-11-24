import { handlePipelineRequest } from "@/lib/access/pipeline";
import { serverAccessDependencies } from "@/lib/access/server";
import { generateSpecification } from "@/lib/orchestration/generateSpecification";
import { SpecificationInputSchema } from "@/lib/schemas/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handlePipelineRequest(
    request,
    {
      route: "specification",
      schema: SpecificationInputSchema,
      recorded: (example) => example.specification,
      live: (input, providers) => generateSpecification(input, providers),
    },
    serverAccessDependencies(),
  );
}
