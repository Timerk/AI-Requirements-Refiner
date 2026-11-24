import { expect, test } from "@playwright/test";

test("the landing page opens the refiner with recorded examples", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Turn a rough idea into a specification you can build.",
    }),
  ).toBeVisible();
  await expect(page.getByText("No, keep books only for this session.")).toBeVisible();
  await page.getByRole("link", { name: "Try a recorded example" }).click();
  await expect(page).toHaveURL(/\/refine$/);
  await expect(page.getByRole("radio", { name: /Recorded example/ })).toBeChecked();
});

test("completes the full flow with a recorded example and no paid call", async ({
  page,
}) => {
  const pipelineRequests: { mode: unknown; key: string | null }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() === "POST")
      pipelineRequests.push({
        mode: request.postDataJSON()?.mode,
        key: request.headers()["x-openai-key"] ?? null,
      });
  });

  await page.goto("/refine");
  await expect(page.getByRole("radio", { name: /Recorded example/ })).toBeChecked();
  // The deployment runs with DEMO_ONLY=true: live mode is visibly off.
  await expect(page.getByRole("radio", { name: /Live with Luna/ })).toBeDisabled();

  await page.getByRole("radio", { name: /Payment webhook relay/ }).check();
  await expect(page.getByLabel("What do you want to build?")).toHaveValue(
    /webhooks from our payment provider/,
  );
  await page.getByRole("button", { name: /Walk through example/ }).click();

  // Clarification: recorded label, reviewed questions, prefilled answers.
  await expect(page.getByText("Recorded example", { exact: true })).toBeVisible();
  await expect(page.getByText(/No model was called/)).toBeVisible();
  const latency = page.getByLabel(/How long may an event wait/);
  await expect(latency).toHaveValue(/15 minutes/);
  await latency.fill("Within 15 minutes, as recorded.");
  await page.getByRole("button", { name: /Generate specification/ }).click();

  // Result: recorded specification with review decisions and export actions.
  await expect(
    page.getByRole("heading", { name: "Payment webhook relay" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded example · Final specification"),
  ).toBeVisible();
  await expect(page.getByText("Live output", { exact: true })).toHaveCount(0);
  await expect(page.getByText("FR-008", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy specification" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download \.md/ }).click();
  expect((await download).suggestedFilename()).toBe(
    "recorded-example-payment-webhook-relay-specification.md",
  );

  expect(pipelineRequests).toEqual([
    { mode: "demo", key: null },
    { mode: "demo", key: null },
  ]);
});

test("refuses live requests on a demo-only deployment", async ({ request }) => {
  const response = await request.post("/api/analyze", {
    data: {
      description: "A live request that must never reach a paid API.",
      complexity: "prototype",
      mode: "live",
    },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({
    code: "live_disabled",
    fallback: "demo",
  });
});
