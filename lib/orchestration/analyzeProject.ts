import type { Providers } from "@/lib/llm/types";
import { ProjectAnalysisSchema } from "@/lib/schemas/analysis";
import { AnalysisReviewSchema } from "@/lib/schemas/analysisReview";
import {
  IdeaSchema,
  type Idea,
  type AnalysisResult,
} from "@/lib/schemas/contracts";
import { assertUniqueIds } from "@/lib/schemas/integrity";
import { runStage } from "./stage";

export async function analyzeProject(
  input: Idea,
  { author, reviewer }: Providers,
): Promise<AnalysisResult> {
  const idea = IdeaSchema.parse(input);
  const analysis = await runStage(
    author,
    "analyze-requirements",
    ProjectAnalysisSchema,
    idea,
    (result) => assertUniqueIds(result.questions),
  );
  const review = await runStage(
    reviewer,
    "review-requirements",
    AnalysisReviewSchema,
    { ...idea, analysis },
    (result) => {
      assertUniqueIds(result.finalQuestions);
      assertUniqueIds(result.addedQuestions);
      const originalIds = new Set(analysis.questions.map(({ id }) => id));
      const finalIds = new Set(result.finalQuestions.map(({ id }) => id));
      const removed = new Set(result.removedQuestionIds);
      if (
        removed.size !== result.removedQuestionIds.length ||
        [...removed].some((id) => !originalIds.has(id) || finalIds.has(id)) ||
        [...originalIds].some((id) => !finalIds.has(id) && !removed.has(id))
      ) {
        throw new Error("Removed question metadata is inconsistent.");
      }
      const added = result.finalQuestions.filter(
        ({ id }) => !originalIds.has(id),
      );
      if (
        added.length !== result.addedQuestions.length ||
        result.addedQuestions.some(
          (question) =>
            !added.some(
              (item) => JSON.stringify(item) === JSON.stringify(question),
            ),
        )
      ) {
        throw new Error("Added question metadata is inconsistent.");
      }
    },
  );
  return { analysis, review, questions: review.finalQuestions };
}
