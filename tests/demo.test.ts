import { describe, expect, it } from "vitest";
import { demoExamples } from "@/lib/demo/examples";
import type { StructuredGenerationRequest } from "@/lib/llm/types";
import { analyzeProject } from "@/lib/orchestration/analyzeProject";
import { generateSpecification } from "@/lib/orchestration/generateSpecification";
import {
  AnalysisResultSchema,
  SpecificationInputSchema,
  SpecificationResultSchema,
} from "@/lib/schemas/contracts";

function replay(outputs: unknown[]) {
  let index = 0;
  const llm = {
    async generate<T>({ schema }: StructuredGenerationRequest<T>) {
      return schema.parse(outputs[index++]);
    },
  };
  return { author: llm, reviewer: llm };
}

describe.each(demoExamples)("recorded example $id", (example) => {
  it("matches the API contracts", () => {
    expect(AnalysisResultSchema.parse(example.analysis)).toEqual(
      example.analysis,
    );
    expect(SpecificationResultSchema.parse(example.specification)).toEqual(
      example.specification,
    );
  });

  it("passes every validation the live pipeline applies between stages", async () => {
    // Replaying the recording through the real orchestration runs the same
    // question-consistency, integrity, and review-decision checks as live output.
    const analysis = await analyzeProject(
      example.idea,
      replay([example.analysis.analysis, example.analysis.review]),
    );
    expect(analysis).toEqual(example.analysis);
    const input = SpecificationInputSchema.parse({
      ...example.idea,
      analysis: example.analysis.analysis,
      questions: example.analysis.questions,
      answers: example.answers,
    });
    const specification = await generateSpecification(
      input,
      replay([
        example.specification.draft,
        example.specification.review,
        {
          specification: example.specification.finalSpecification,
          reviewDecisions: example.specification.reviewDecisions,
        },
      ]),
    );
    expect(specification).toEqual(example.specification);
  });
});

it("offers several distinct examples, including richer ones than the test fixture", () => {
  expect(new Set(demoExamples.map(({ id }) => id)).size).toBe(
    demoExamples.length,
  );
  expect(demoExamples.length).toBeGreaterThanOrEqual(3);
  expect(
    demoExamples.some(
      (example) =>
        example.specification.finalSpecification.functionalRequirements.length >=
        5,
    ),
  ).toBe(true);
});
