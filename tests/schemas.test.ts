import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { ProjectAnalysisSchema } from "@/lib/schemas/analysis";
import { AnalysisReviewSchema } from "@/lib/schemas/analysisReview";
import {
  FinalRevisionSchema,
  ProjectSpecificationSchema,
} from "@/lib/schemas/specification";
import { SpecificationReviewSchema } from "@/lib/schemas/specificationReview";
import { IdeaSchema, SpecificationInputSchema } from "@/lib/schemas/contracts";
import { assertSpecificationIntegrity } from "@/lib/schemas/integrity";
import { idea, specification, specificationInput } from "./fixtures";

describe("request contracts", () => {
  it("rejects empty descriptions and unsupported complexity", () => {
    expect(IdeaSchema.safeParse({ ...idea, description: "  " }).success).toBe(
      false,
    );
    expect(
      IdeaSchema.safeParse({ ...idea, complexity: "enterprise" }).success,
    ).toBe(false);
  });
  it("requires answers only for required questions, allowing explicit uncertainty", () => {
    expect(SpecificationInputSchema.safeParse(specificationInput).success).toBe(
      true,
    );
    expect(
      SpecificationInputSchema.safeParse({
        ...specificationInput,
        answers: { "Q-001": " " },
      }).success,
    ).toBe(false);
    expect(
      SpecificationInputSchema.safeParse({
        ...specificationInput,
        answers: { "Q-001": "Undecided" },
      }).success,
    ).toBe(true);
  });
  it("rejects duplicate question IDs and answers without questions", () => {
    expect(
      SpecificationInputSchema.safeParse({
        ...specificationInput,
        questions: [
          specificationInput.questions[0],
          specificationInput.questions[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      SpecificationInputSchema.safeParse({
        ...specificationInput,
        answers: { ...specificationInput.answers, unknown: "yes" },
      }).success,
    ).toBe(false);
  });
});

describe("specification integrity", () => {
  it("accepts a complete, traceable specification", () => {
    expect(() =>
      assertSpecificationIntegrity(
        ProjectSpecificationSchema.parse(specification),
      ),
    ).not.toThrow();
  });
  it("rejects duplicate IDs and broken references", () => {
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        functionalRequirements: [
          ...specification.functionalRequirements,
          ...specification.functionalRequirements,
        ],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        acceptanceCriteria: [
          { id: "AC-001", requirementId: "FR-404", criterion: "Test" },
        ],
      }),
    ).toThrow(/unknown requirement/);
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        implementationTasks: [
          {
            ...specification.implementationTasks[0],
            dependencies: ["TASK-404"],
          },
        ],
      }),
    ).toThrow(/unknown dependency/);
  });
  it("rejects missing coverage and dependency cycles", () => {
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        acceptanceCriteria: [],
      }),
    ).toThrow(/Every requirement/);
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        implementationTasks: [],
      }),
    ).toThrow(/Every requirement/);
    expect(() =>
      assertSpecificationIntegrity({
        ...specification,
        implementationTasks: [
          {
            ...specification.implementationTasks[0],
            dependencies: ["TASK-002"],
          },
          {
            ...specification.implementationTasks[0],
            id: "TASK-002",
            dependencies: ["TASK-001"],
          },
        ],
      }),
    ).toThrow(/cycle/);
  });
});

it("all model schemas serialize for both SDK structured-output formats", () => {
  for (const schema of [
    ProjectAnalysisSchema,
    AnalysisReviewSchema,
    ProjectSpecificationSchema,
    SpecificationReviewSchema,
    FinalRevisionSchema,
  ]) {
    expect(zodTextFormat(schema, "result").type).toBe("json_schema");
    expect(z.toJSONSchema(schema).type).toBe("object");
  }
});
