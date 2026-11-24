// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { ClarificationForm } from "@/components/ClarificationForm";
import { RunModePicker } from "@/components/RunModePicker";
import { SpecificationView } from "@/components/SpecificationView";
import {
  addedQuestion,
  analysis,
  analysisReview,
  revision,
  specification,
  specificationReview,
} from "./fixtures";

afterEach(cleanup);

it.each([
  [1, "1 question added", "1 assumption challenged"],
  [2, "2 questions added", "2 assumptions challenged"],
])("formats analysis review counts of %i", (count, added, challenged) => {
  render(
    <AnalysisSummary
      result={{
        analysis,
        review: {
          ...analysisReview,
          addedQuestions: [
            addedQuestion,
            { ...addedQuestion, id: "Q-003" },
          ].slice(0, count),
          challengedAssumptions: [
            ...analysisReview.challengedAssumptions,
            "Visibility is not confirmed.",
          ].slice(0, count),
        },
        questions: analysisReview.finalQuestions,
      }}
    />,
  );

  expect(screen.getByText(/questions? added/).textContent).toBe(added);
  expect(screen.getByText(/assumptions? challenged/).textContent).toBe(
    challenged,
  );
  expect(screen.getByText("removed").textContent).toBe("0 removed");
});

it.each([
  [1, "1 decision to clarify"],
  [2, "2 decisions to clarify"],
])("formats the clarification heading for %i", (count, heading) => {
  render(
    <ClarificationForm
      questions={analysisReview.finalQuestions.slice(0, count)}
      answers={{}}
      onChange={() => {}}
      onSubmit={() => {}}
      onBack={() => {}}
    />,
  );

  expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
});

it.each([
  [
    1,
    "1 review finding considered",
    "1 open decision remains.",
    "Resolve it before implementing dependent tasks.",
  ],
  [
    2,
    "2 review findings considered",
    "2 open decisions remain.",
    "Resolve them before implementing dependent tasks.",
  ],
])(
  "formats specification counts of %i",
  (count, findings, decisions, instruction) => {
    render(
      <SpecificationView
        result={{
          draft: specification,
          review: {
            ...specificationReview,
            issues: [
              ...specificationReview.issues,
              { ...specificationReview.issues[0], description: "Check scope." },
            ].slice(0, count),
          },
          finalSpecification: {
            ...revision.specification,
            unresolvedQuestions: [
              ...revision.specification.unresolvedQuestions,
              "How should books be sorted?",
            ].slice(0, count),
          },
          reviewDecisions: revision.reviewDecisions,
        }}
        onBack={() => {}}
        onReset={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: findings })).toBeTruthy();
    expect(screen.getByText(instruction).textContent).toBe(
      `${decisions} ${instruction}`,
    );
  },
);

it.each([
  [1, "1 free run per visitor per day, or use your own key"],
  [2, "2 free runs per visitor per day, or use your own key"],
])("formats a daily limit of %i", (perIpLimit, detail) => {
  render(
    <RunModePicker
      access={{
        hostedLive: true,
        visitorKey: true,
        demoOnly: false,
        perIpLimit,
      }}
      mode="live"
      onModeChange={() => {}}
      examples={[]}
      exampleId=""
      onExampleChange={() => {}}
      apiKey=""
      onApiKeyChange={() => {}}
    />,
  );

  expect(screen.getByText(detail)).toBeTruthy();
});
