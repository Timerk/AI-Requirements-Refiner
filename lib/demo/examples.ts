import { gardenShiftsExample } from "./examples/gardenShifts";
import { readingListExample } from "./examples/readingList";
import { webhookRelayExample } from "./examples/webhookRelay";
import type { DemoExample } from "./types";

export type { DemoExample } from "./types";

// The first example is preselected in the picker: garden shifts shows the
// review mechanic best and needs no technical background to follow.
export const demoExamples: readonly DemoExample[] = [
  gardenShiftsExample,
  readingListExample,
  webhookRelayExample,
];

export function findDemoExample(id: unknown): DemoExample | undefined {
  return demoExamples.find((example) => example.id === id);
}
