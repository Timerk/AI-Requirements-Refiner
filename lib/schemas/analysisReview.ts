import { z } from "zod";
import { IdSchema, QuestionsSchema, TextSchema } from "./analysis";

export const AnalysisReviewSchema = z.object({
  assessment: TextSchema,
  challengedAssumptions: z.array(TextSchema),
  missingTopics: z.array(TextSchema),
  removedQuestionIds: z.array(IdSchema),
  addedQuestions: QuestionsSchema,
  finalQuestions: QuestionsSchema,
});
export type AnalysisReview = z.infer<typeof AnalysisReviewSchema>;
