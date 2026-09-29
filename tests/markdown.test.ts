import { expect, it } from "vitest";
import { specificationToMarkdown } from "@/lib/markdown";
import { specification } from "./fixtures";

it("renders every section with traceable IDs and an independent agent prompt", () => {
  const markdown = specificationToMarkdown(specification);
  expect(markdown).toContain("# Reading list\n\n## Goal\n");
  expect(markdown).toContain("### AC-001\n\nRequirement: FR-001");
  expect(markdown).toContain("Requirements: FR-001\n\nDependencies: None");
  expect(markdown).toContain("## Assumptions\n\nNone specified.");
  expect(markdown).toContain("## Unresolved questions");
  expect(markdown).toContain(specification.implementationPrompt);
  expect(specificationToMarkdown(specification)).toBe(markdown);
});

it("escapes Markdown and HTML in prose and safely fences embedded backticks", () => {
  const markdown = specificationToMarkdown({
    ...specification,
    goal: "<script>alert(1)</script> [link](https://example.com)",
    implementationPrompt: "Use ```ts\nconst x = 1;\n```",
  });
  expect(markdown).not.toContain("<script>");
  expect(markdown).toContain("\\[link\\]\\(");
  expect(markdown).toContain("````text\nUse ```ts");
  expect(markdown.endsWith("````\n")).toBe(true);
});
