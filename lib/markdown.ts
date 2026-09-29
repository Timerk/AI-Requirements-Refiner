import type { ProjectSpecification } from "./schemas/specification";

// Escape model text so Markdown structure belongs to the renderer, not the model.
export function markdownText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|>~-])/g, "\\$1")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "  \n");
}

export function specificationToMarkdown(spec: ProjectSpecification): string {
  const lines = [
    `# ${markdownText(spec.projectName)}`,
    "",
    "## Goal",
    "",
    markdownText(spec.goal),
  ];
  function section(title: string, entries: string[]) {
    lines.push(
      "",
      `## ${title}`,
      "",
      ...(entries.length ? entries : ["None specified."]),
    );
  }
  const bullets = (items: string[]) =>
    items.map((text) => `- ${markdownText(text)}`);
  section("Scope", bullets(spec.scope));
  section("Out of scope", bullets(spec.outOfScope));
  section("Users", bullets(spec.users));
  for (const [title, items] of [
    ["Functional requirements", spec.functionalRequirements],
    ["Nonfunctional requirements", spec.nonFunctionalRequirements],
  ] as const) {
    section(
      title,
      items.map(
        (item) => `### ${item.id}\n\n${markdownText(item.description)}\n`,
      ),
    );
  }
  section("Technology constraints", bullets(spec.technologyConstraints));
  section("Data requirements", bullets(spec.dataRequirements));
  section(
    "Acceptance criteria",
    spec.acceptanceCriteria.map(
      (item) =>
        `### ${item.id}\n\nRequirement: ${item.requirementId}\n\n${markdownText(item.criterion)}\n`,
    ),
  );
  section("Edge cases", bullets(spec.edgeCases));
  section("Assumptions", bullets(spec.assumptions));
  section("Unresolved questions", bullets(spec.unresolvedQuestions));
  section(
    "Implementation tasks",
    spec.implementationTasks.map(
      (task) =>
        `### ${task.id}: ${markdownText(task.title)}\n\n${markdownText(task.description)}\n\nRequirements: ${task.requirementIds.join(", ")}\n\nDependencies: ${task.dependencies.join(", ") || "None"}\n`,
    ),
  );
  const longestFence = Math.max(
    2,
    ...(spec.implementationPrompt.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(longestFence + 1);
  section("Coding-agent implementation prompt", [
    `${fence}text\n${spec.implementationPrompt}\n${fence}`,
  ]);
  return `${lines.join("\n").trim()}\n`;
}
