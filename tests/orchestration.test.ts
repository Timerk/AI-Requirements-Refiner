import { describe, expect, it, vi } from "vitest";
import type { StructuredGenerationRequest } from "@/lib/llm/types";
import { ProviderError } from "@/lib/llm/errors";
import { analyzeProject } from "@/lib/orchestration/analyzeProject";
import { generateSpecification } from "@/lib/orchestration/generateSpecification";
import {
  analysis,
  analysisReview,
  idea,
  revision,
  specification,
  specificationInput,
  specificationReview,
} from "./fixtures";

function provider(outputs: unknown[], order: string[], name: string) {
  let index = 0;
  const fake = {
    async generate<T>(request: StructuredGenerationRequest<T>): Promise<T> {
      order.push(name);
      const output = outputs[index++];
      if (output instanceof Error) throw output;
      return request.schema.parse(output);
    },
  };
  const calls = vi.spyOn(fake, "generate");
  return { ...fake, calls };
}

describe("analysis pipeline", () => {
  it("runs the critic after the analyst and presents only reviewed questions", async () => {
    const order: string[] = [];
    const author = provider([analysis], order, "author");
    const reviewed = {
      ...analysisReview,
      removedQuestionIds: ["Q-001"],
      finalQuestions: analysisReview.addedQuestions,
    };
    const reviewer = provider([reviewed], order, "reviewer");
    const result = await analyzeProject(idea, { author, reviewer });
    expect(order).toEqual(["author", "reviewer"]);
    expect(result.questions).toEqual(reviewed.finalQuestions);
    expect(reviewer.calls.mock.calls[0][0].input).toEqual({
      ...idea,
      analysis,
    });
  });
  it("fails visibly when the critic fails, without returning unreviewed questions", async () => {
    const author = provider([analysis], [], "author");
    const reviewer = provider(
      [new ProviderError("OpenAI rate limit reached", 429)],
      [],
      "reviewer",
    );
    await expect(
      analyzeProject(idea, { author, reviewer }),
    ).rejects.toMatchObject({ stage: "review-requirements", status: 429 });
  });
  it("rejects inconsistent review metadata", async () => {
    await expect(
      analyzeProject(idea, {
        author: provider([analysis], [], "author"),
        reviewer: provider(
          [{ ...analysisReview, removedQuestionIds: ["Q-404"] }],
          [],
          "reviewer",
        ),
      }),
    ).rejects.toMatchObject({ stage: "review-requirements" });
  });
  it("never sends invalid analysis to the reviewer", async () => {
    const reviewer = provider([analysisReview], [], "reviewer");
    await expect(
      analyzeProject(idea, {
        author: provider([{ nonsense: true }], [], "author"),
        reviewer,
      }),
    ).rejects.toMatchObject({ stage: "analyze-requirements" });
    expect(reviewer.generate).not.toHaveBeenCalled();
  });
});

describe("specification pipeline", () => {
  it("authors, critiques, and revises with the review and human context intact", async () => {
    const order: string[] = [];
    const author = provider([specification, revision], order, "author");
    const reviewer = provider([specificationReview], order, "reviewer");
    const result = await generateSpecification(specificationInput, {
      author,
      reviewer,
    });
    expect(order).toEqual(["author", "reviewer", "author"]);
    expect(author.generate).toHaveBeenCalledTimes(2);
    expect(reviewer.generate).toHaveBeenCalledTimes(1);
    expect(author.calls.mock.calls[1][0].input).toEqual({
      ...specificationInput,
      draft: specification,
      review: specificationReview,
    });
    expect(author.calls.mock.calls[1][0].instructions).toContain(
      "Reviewer recommendations",
    );
    expect(result).toEqual({
      draft: specification,
      review: specificationReview,
      finalSpecification: revision.specification,
      reviewDecisions: revision.reviewDecisions,
    });
  });
  it("stops before revision when specification review fails", async () => {
    const author = provider([specification, revision], [], "author");
    await expect(
      generateSpecification(specificationInput, {
        author,
        reviewer: provider([new Error("Offline")], [], "reviewer"),
      }),
    ).rejects.toMatchObject({ stage: "review-specification" });
    expect(author.generate).toHaveBeenCalledTimes(1);
  });
  it("rejects a final revision with broken traceability or missing feedback decisions", async () => {
    for (const invalid of [
      { ...revision, reviewDecisions: [] },
      {
        ...revision,
        specification: { ...specification, implementationTasks: [] },
      },
    ]) {
      await expect(
        generateSpecification(specificationInput, {
          author: provider([specification, invalid], [], "author"),
          reviewer: provider([specificationReview], [], "reviewer"),
        }),
      ).rejects.toMatchObject({ stage: "finalize-specification" });
    }
  });
});
