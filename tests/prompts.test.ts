import { expect, it } from "vitest";
import { loadPrompt, promptNames } from "@/lib/prompts/loader";

it("loads all five substantive, task-specific Markdown prompts", async () => {
  const prompts = await Promise.all(promptNames.map(loadPrompt));
  for (const prompt of prompts) {
    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt).toMatch(/JSON/);
  }
  expect(new Set(prompts).size).toBe(5);
});

it("keeps human authority and unresolved decisions in the finalization instructions", async () => {
  const prompt = await loadPrompt("finalize-specification");
  expect(prompt.indexOf("Explicit user statements")).toBeLessThan(
    prompt.indexOf("Reviewer recommendations"),
  );
  expect(prompt).toContain(
    "Reject recommendations conflicting with human intent",
  );
  expect(prompt).toContain("unresolvedQuestions");
});
