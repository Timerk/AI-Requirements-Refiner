import { z } from "zod";

export const TextSchema = z.string().trim().min(1).max(12000);
export const IdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const QuestionSchema = z.object({
  id: IdSchema,
  category: z.enum([
    "scope",
    "users",
    "functionality",
    "technology",
    "data",
    "authentication",
    "integration",
    "constraints",
    "quality",
    "acceptance",
    "other",
  ]),
  question: TextSchema,
  reason: TextSchema,
  importance: z.enum(["required", "recommended", "optional"]),
});
export const QuestionsSchema = z.array(QuestionSchema).max(30);
export const ProjectAnalysisSchema = z.object({
  understoodGoal: TextSchema,
  knownFacts: z.array(TextSchema),
  assumptions: z.array(TextSchema),
  ambiguities: z.array(TextSchema),
  questions: QuestionsSchema,
});
export type Question = z.infer<typeof QuestionSchema>;
export type ProjectAnalysis = z.infer<typeof ProjectAnalysisSchema>;
