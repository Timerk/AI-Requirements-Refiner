import type { Providers } from "@/lib/llm/types";
import {
  SpecificationInputSchema,
  type SpecificationInput,
  type SpecificationResult,
} from "@/lib/schemas/contracts";
import {
  FinalRevisionSchema,
  ProjectSpecificationSchema,
} from "@/lib/schemas/specification";
import { SpecificationReviewSchema } from "@/lib/schemas/specificationReview";
import { assertSpecificationIntegrity } from "@/lib/schemas/integrity";
import { runStage } from "./stage";

export async function generateSpecification(
  input: SpecificationInput,
  { author, reviewer }: Providers,
): Promise<SpecificationResult> {
  const context = SpecificationInputSchema.parse(input);
  const draft = await runStage(
    author,
    "generate-specification",
    ProjectSpecificationSchema,
    context,
    assertSpecificationIntegrity,
  );
  const review = await runStage(
    reviewer,
    "review-specification",
    SpecificationReviewSchema,
    { ...context, draft },
    (result) => {
      if ((result.verdict === "approved") !== (result.issues.length === 0))
        throw new Error("Review verdict contradicts its issues.");
    },
  );
  const revision = await runStage(
    author,
    "finalize-specification",
    FinalRevisionSchema,
    { ...context, draft, review },
    (result) => {
      assertSpecificationIntegrity(result.specification);
      const indices = new Set(
        result.reviewDecisions.map((decision) => decision.issueIndex),
      );
      if (
        indices.size !== review.issues.length ||
        result.reviewDecisions.length !== review.issues.length ||
        [...indices].some((index) => index >= review.issues.length)
      ) {
        throw new Error(
          "Each review issue requires exactly one revision decision.",
        );
      }
    },
  );
  return {
    draft,
    review,
    finalSpecification: revision.specification,
    reviewDecisions: revision.reviewDecisions,
  };
}
