import { z } from "zod";
import { TextSchema } from "./analysis";

export const SpecificationIssueSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum([
    "missing_requirement",
    "unsupported_assumption",
    "contradiction",
    "scope_creep",
    "acceptance_criteria",
    "edge_case",
    "task_coverage",
    "other",
  ]),
  description: TextSchema,
  recommendedChange: TextSchema,
});
export const SpecificationReviewSchema = z.object({
  verdict: z.enum(["approved", "changes_required"]),
  issues: z.array(SpecificationIssueSchema),
  summary: TextSchema,
});
export type SpecificationReview = z.infer<typeof SpecificationReviewSchema>;
