import type { SpecificationInput } from "@/lib/schemas/contracts";
import {
  analysisReview,
  answers,
  idea,
  analysis,
} from "@/lib/demo/examples/readingList";

// The reading-list demo example doubles as the shared test fixture.
export {
  addedQuestion,
  analysis,
  analysisReview,
  idea,
  question,
  revision,
  specification,
  specificationReview,
} from "@/lib/demo/examples/readingList";

export const specificationInput: SpecificationInput = {
  ...idea,
  analysis,
  questions: analysisReview.finalQuestions,
  answers,
};
