import type { AnalysisResult, Idea, SpecificationResult } from "@/lib/schemas/contracts";

/**
 * A complete, pre-recorded walk through the pipeline. Demo mode serves these
 * outputs instead of calling a model, so they must satisfy the same schemas and
 * integrity checks as live output (see tests/demo.test.ts).
 */
export interface DemoExample {
  id: string;
  title: string;
  summary: string;
  idea: Idea;
  /** The clarification answers the recorded specification is based on. */
  answers: Record<string, string>;
  analysis: AnalysisResult;
  specification: SpecificationResult;
}
