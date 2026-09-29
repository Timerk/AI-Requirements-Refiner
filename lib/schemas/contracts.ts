import { z } from "zod";
import { ProjectAnalysisSchema, QuestionsSchema } from "./analysis";
import { AnalysisReviewSchema } from "./analysisReview";
import {
  FinalRevisionSchema,
  ProjectSpecificationSchema,
} from "./specification";
import { SpecificationReviewSchema } from "./specificationReview";

export const IdeaSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Describe your idea in at least 10 characters.")
    .max(12000),
  complexity: z.enum(["prototype", "small_application", "production_system"]),
});
export const AnalysisResultSchema = z.object({
  analysis: ProjectAnalysisSchema,
  review: AnalysisReviewSchema,
  questions: QuestionsSchema,
});
export const SpecificationInputSchema = IdeaSchema.extend({
  analysis: ProjectAnalysisSchema,
  questions: QuestionsSchema,
  answers: z.record(z.string(), z.string().trim().max(6000)),
}).superRefine((input, ctx) => {
  const ids = new Set<string>();
  input.questions.forEach((question, index) => {
    if (ids.has(question.id))
      ctx.addIssue({
        code: "custom",
        path: ["questions", index, "id"],
        message: "Question IDs must be unique.",
      });
    ids.add(question.id);
    if (
      question.importance === "required" &&
      !input.answers[question.id]?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["answers", question.id],
        message:
          "Answer all required questions. You can explicitly say that a decision is unresolved.",
      });
    }
  });
  for (const id of Object.keys(input.answers)) {
    if (!ids.has(id))
      ctx.addIssue({
        code: "custom",
        path: ["answers", id],
        message: "Answer references an unknown question.",
      });
  }
});
export const SpecificationResultSchema = z.object({
  draft: ProjectSpecificationSchema,
  review: SpecificationReviewSchema,
  finalSpecification: ProjectSpecificationSchema,
  reviewDecisions: FinalRevisionSchema.shape.reviewDecisions,
});
export type Idea = z.infer<typeof IdeaSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type SpecificationInput = z.infer<typeof SpecificationInputSchema>;
export type SpecificationResult = z.infer<typeof SpecificationResultSchema>;
