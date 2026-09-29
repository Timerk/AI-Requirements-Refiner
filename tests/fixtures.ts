import type { ProjectAnalysis, Question } from "@/lib/schemas/analysis";
import type { AnalysisReview } from "@/lib/schemas/analysisReview";
import type { Idea, SpecificationInput } from "@/lib/schemas/contracts";
import type { ProjectSpecification } from "@/lib/schemas/specification";
import type { SpecificationReview } from "@/lib/schemas/specificationReview";

export const idea: Idea = {
  description: "Build a local reading list for my books.",
  complexity: "small_application",
};
export const question: Question = {
  id: "Q-001",
  category: "data",
  question: "Should books persist after closing the app?",
  reason: "Determines storage requirements.",
  importance: "required",
};
export const addedQuestion: Question = {
  id: "Q-002",
  category: "scope",
  question: "Should finished books remain visible?",
  reason: "Determines the reading workflow.",
  importance: "optional",
};
export const analysis: ProjectAnalysis = {
  understoodGoal: "Track books in a local reading list.",
  knownFacts: ["The app is for personal use."],
  assumptions: ["Books need durable storage."],
  ambiguities: ["Storage lifetime is unspecified."],
  questions: [question],
};
export const analysisReview: AnalysisReview = {
  assessment: "Storage needs clarification; ask about finished books too.",
  challengedAssumptions: ["Persistence is not confirmed."],
  missingTopics: ["Finished books"],
  removedQuestionIds: [],
  addedQuestions: [addedQuestion],
  finalQuestions: [question, addedQuestion],
};
export const specificationInput: SpecificationInput = {
  ...idea,
  analysis,
  questions: analysisReview.finalQuestions,
  answers: { "Q-001": "No, keep books only for this session." },
};
export const specification: ProjectSpecification = {
  projectName: "Reading list",
  goal: "Keep a list of books for this session.",
  scope: ["Add and list books"],
  outOfScope: ["Persistent storage"],
  users: ["One reader"],
  functionalRequirements: [
    { id: "FR-001", description: "Add a book title to the session's list." },
  ],
  nonFunctionalRequirements: [],
  technologyConstraints: [],
  dataRequirements: ["Store titles only in memory."],
  acceptanceCriteria: [
    {
      id: "AC-001",
      requirementId: "FR-001",
      criterion:
        "Adding a title shows it in the list; a reload clears the list.",
    },
  ],
  edgeCases: ["Reject empty titles."],
  assumptions: [],
  unresolvedQuestions: ["Whether finished books should remain visible."],
  implementationTasks: [
    {
      id: "TASK-001",
      title: "Build the reading list",
      description: "Add the title input and in-memory list.",
      requirementIds: ["FR-001"],
      dependencies: [],
    },
  ],
  implementationPrompt:
    "Build a local reading list. Implement FR-001 and verify AC-001. Keep titles in memory only. Ask whether finished books should remain visible before implementing that behavior.",
};
export const specificationReview: SpecificationReview = {
  verdict: "changes_required",
  summary: "The scope is clear, but empty input needs an acceptance criterion.",
  issues: [
    {
      severity: "medium",
      category: "acceptance_criteria",
      description: "Empty title handling has no criterion.",
      recommendedChange: "Add a criterion for rejecting an empty title.",
    },
  ],
};
export const revision = {
  specification: {
    ...specification,
    acceptanceCriteria: [
      ...specification.acceptanceCriteria,
      {
        id: "AC-002",
        requirementId: "FR-001",
        criterion:
          "Submitting a blank title shows a validation message and creates no book.",
      },
    ],
  },
  reviewDecisions: [
    {
      issueIndex: 0,
      disposition: "applied" as const,
      reason: "Added AC-002 for empty titles.",
    },
  ],
};
