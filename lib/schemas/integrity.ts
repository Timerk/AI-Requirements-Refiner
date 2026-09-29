import type { ProjectSpecification } from "./specification";

// JSON schemas validate shape; these checks validate cross-references and task order.
export function assertUniqueIds(items: { id: string }[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("Model output contains duplicate IDs.");
  }
}

export function assertSpecificationIntegrity(spec: ProjectSpecification) {
  const requirements = [
    ...spec.functionalRequirements,
    ...spec.nonFunctionalRequirements,
  ];
  assertUniqueIds([
    ...requirements,
    ...spec.acceptanceCriteria,
    ...spec.implementationTasks,
  ]);
  const requirementIds = new Set(requirements.map((item) => item.id));
  const tasks = new Map(
    spec.implementationTasks.map((task) => [task.id, task]),
  );
  const covered = new Set<string>();
  const tested = new Set<string>();
  for (const criterion of spec.acceptanceCriteria) {
    if (!requirementIds.has(criterion.requirementId))
      throw new Error(
        "Acceptance criterion references an unknown requirement.",
      );
    tested.add(criterion.requirementId);
  }
  for (const task of tasks.values()) {
    for (const id of task.requirementIds) {
      if (!requirementIds.has(id))
        throw new Error("Task references an unknown requirement.");
      covered.add(id);
    }
    if (task.dependencies.some((id) => !tasks.has(id)))
      throw new Error("Task references an unknown dependency.");
  }
  if (requirements.some(({ id }) => !covered.has(id) || !tested.has(id))) {
    throw new Error(
      "Every requirement needs an acceptance criterion and an implementation task.",
    );
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Task dependencies contain a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    tasks.get(id)?.dependencies.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  tasks.forEach((_, id) => visit(id));
}
