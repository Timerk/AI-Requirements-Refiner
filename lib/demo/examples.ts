import { gardenShiftsExample } from "./examples/gardenShifts";
import { readingListExample } from "./examples/readingList";
import { webhookRelayExample } from "./examples/webhookRelay";
import type { DemoExample } from "./types";

export type { DemoExample } from "./types";

export const demoExamples: readonly DemoExample[] = [
  readingListExample,
  gardenShiftsExample,
  webhookRelayExample,
];

export function findDemoExample(id: unknown): DemoExample | undefined {
  return demoExamples.find((example) => example.id === id);
}
