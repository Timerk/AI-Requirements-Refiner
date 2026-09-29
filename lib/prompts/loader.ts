import { readFile } from "node:fs/promises";
import path from "node:path";

export const promptNames = [
  "analyze-requirements",
  "review-requirements",
  "generate-specification",
  "review-specification",
  "finalize-specification",
] as const;
export type PromptName = (typeof promptNames)[number];

export async function loadPrompt(name: PromptName): Promise<string> {
  if (!promptNames.includes(name)) throw new Error("Unknown prompt.");
  const prompt = await readFile(
    path.join(process.cwd(), "prompts", `${name}.md`),
    "utf8",
  );
  if (!prompt.trim()) throw new Error(`Prompt ${name} is empty.`);
  return prompt;
}
