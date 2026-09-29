// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Home from "@/app/page";
import {
  analysis,
  analysisReview,
  idea,
  question,
  revision,
  specification,
  specificationReview,
} from "./fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const analysisResponse = {
  analysis,
  review: analysisReview,
  questions: analysisReview.finalQuestions,
};
const specificationResponse = {
  draft: specification,
  review: specificationReview,
  finalSpecification: revision.specification,
  reviewDecisions: revision.reviewDecisions,
};

async function enterIdea() {
  fireEvent.change(screen.getByLabelText("What do you want to build?"), {
    target: { value: idea.description },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  await screen.findByLabelText(question.question);
}

it("completes clarification and displays the final specification, review decisions, and both copy actions", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(analysisResponse))
    .mockResolvedValueOnce(Response.json(specificationResponse));
  vi.stubGlobal("fetch", fetchMock);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<Home />);
  await enterIdea();
  fireEvent.change(screen.getByLabelText(question.question), {
    target: { value: "No, this session only." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("heading", { name: "Reading list" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const submitted = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(submitted.answers).toEqual({ "Q-001": "No, this session only." });
  expect(submitted.questions).toEqual(analysisReview.finalQuestions);
  expect(
    screen.getByText(/have not been reviewed again by Luna/),
  ).toBeTruthy();
  expect(screen.getByText("Editor: applied.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy specification" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("# Reading list"),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy agent prompt" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenLastCalledWith(
      revision.specification.implementationPrompt,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit answers" }));
  expect(screen.getByDisplayValue("No, this session only.")).toBeTruthy();
});

it("retains answers after a failed review and retries the complete specification pipeline", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(analysisResponse))
    .mockResolvedValueOnce(
      Response.json(
        { error: "OpenAI rate limit reached.", stage: "review-specification" },
        { status: 429 },
      ),
    )
    .mockResolvedValueOnce(Response.json(specificationResponse));
  vi.stubGlobal("fetch", fetchMock);
  render(<Home />);
  await enterIdea();
  fireEvent.change(screen.getByLabelText(question.question), {
    target: { value: "Undecided" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("Undecided")).toBeTruthy();
  expect(screen.getByText(/Specification review failed/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry generation" }));
  await screen.findByRole("heading", { name: "Reading list" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("preserves the project idea after a network failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Network failure")),
  );
  render(<Home />);
  fireEvent.change(screen.getByLabelText("What do you want to build?"), {
    target: { value: idea.description },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue(idea.description)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry analysis" })).toBeTruthy();
});

it("supports an analysis with no clarification questions", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          analysis: { ...analysis, questions: [] },
          review: { ...analysisReview, addedQuestions: [], finalQuestions: [] },
          questions: [],
        }),
      )
      .mockResolvedValueOnce(Response.json(specificationResponse)),
  );
  render(<Home />);
  fireEvent.change(screen.getByLabelText("What do you want to build?"), {
    target: { value: idea.description },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  await screen.findByRole("heading", { name: "Your idea has enough detail" });
  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("heading", { name: "Reading list" });
});
