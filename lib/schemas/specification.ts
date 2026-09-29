import { z } from "zod";
import { IdSchema, TextSchema } from "./analysis";

const RequirementSchema = z.object({ id: IdSchema, description: TextSchema });
export const ImplementationTaskSchema = z.object({
  id: IdSchema,
  title: TextSchema,
  description: TextSchema,
  requirementIds: z.array(IdSchema).min(1),
  dependencies: z.array(IdSchema),
});
export const ProjectSpecificationSchema = z.object({
  projectName: TextSchema,
  goal: TextSchema,
  scope: z.array(TextSchema),
  outOfScope: z.array(TextSchema),
  users: z.array(TextSchema),
  functionalRequirements: z.array(RequirementSchema).min(1),
  nonFunctionalRequirements: z.array(RequirementSchema),
  technologyConstraints: z.array(TextSchema),
  dataRequirements: z.array(TextSchema),
  acceptanceCriteria: z
    .array(
      z.object({
        id: IdSchema,
        requirementId: IdSchema,
        criterion: TextSchema,
      }),
    )
    .min(1),
  edgeCases: z.array(TextSchema),
  assumptions: z.array(TextSchema),
  unresolvedQuestions: z.array(TextSchema),
  implementationTasks: z.array(ImplementationTaskSchema).min(1),
  implementationPrompt: TextSchema,
});
export const FinalRevisionSchema = z.object({
  specification: ProjectSpecificationSchema,
  reviewDecisions: z.array(
    z.object({
      issueIndex: z.number().int().min(0),
      disposition: z.enum(["applied", "rejected", "deferred"]),
      reason: TextSchema,
    }),
  ),
});
export type ProjectSpecification = z.infer<typeof ProjectSpecificationSchema>;
