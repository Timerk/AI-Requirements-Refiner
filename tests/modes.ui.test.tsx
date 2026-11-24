// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RefinerApp } from "@/components/RefinerApp";
import type { PublicAccess } from "@/lib/access/config";
import { gardenShiftsExample } from "@/lib/demo/examples/gardenShifts";
import { readingListExample } from "@/lib/demo/examples/readingList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const access: PublicAccess = {
  hostedLive: true,
  visitorKey: true,
  demoOnly: false,
  perIpLimit: 3,
};
const recorded = (example = readingListExample) => ({
  analysis: { ...example.analysis, source: "recorded", exampleId: example.id },
  specification: {
    ...example.specification,
    source: "recorded",
    exampleId: example.id,
  },
});
const VISITOR_KEY = "sk-proj-visitorKeyForUiTests1234567890";

function bodyOf(call: unknown[]) {
  return JSON.parse((call[1] as RequestInit).body as string);
}
function headersOf(call: unknown[]) {
  return (call[1] as RequestInit).headers as Record<string, string>;
}
function chooseLive(description = "A reading list for my books.") {
  fireEvent.click(screen.getByRole("radio", { name: /Live with Luna/ }));
  fireEvent.change(screen.getByLabelText("What do you want to build?"), {
    target: { value: description },
  });
}

it("starts in demo mode and walks through a recorded example labelled as recorded", async () => {
  const { analysis, specification } = recorded(gardenShiftsExample);
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(analysis))
    .mockResolvedValueOnce(Response.json(specification));
  vi.stubGlobal("fetch", fetchMock);
  render(<RefinerApp access={access} />);
  expect(
    (screen.getByRole("radio", { name: /Recorded example/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("radio", { name: new RegExp(gardenShiftsExample.title) }),
  );
  const description = screen.getByLabelText(
    "What do you want to build?",
  ) as HTMLTextAreaElement;
  expect(description.readOnly).toBe(true);
  expect(description.value).toBe(gardenShiftsExample.idea.description);
  fireEvent.click(screen.getByRole("button", { name: /Walk through example/ }));

  await screen.findByText(/Prepared in advance for “Community garden/);
  expect(
    screen.getByText("Recorded example", { selector: ".source-notice strong" }),
  ).toBeTruthy();
  expect(screen.queryByText("Live output")).toBeNull();
  expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
    mode: "demo",
    exampleId: "garden-shifts",
  });
  expect(headersOf(fetchMock.mock.calls[0])["X-OpenAI-Key"]).toBeUndefined();
  // The recorded answers are prefilled so the walkthrough stays consistent.
  expect(
    screen.getByDisplayValue(gardenShiftsExample.answers["Q-001"]),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("heading", { name: "Garden shift sign-up" });
  expect(
    screen.getByText("Recorded example · Final specification"),
  ).toBeTruthy();
  expect(bodyOf(fetchMock.mock.calls[1])).toMatchObject({
    mode: "demo",
    exampleId: "garden-shifts",
    answers: gardenShiftsExample.answers,
  });
});

it("never labels a response as live unless the server marks it live", async () => {
  const { source, ...unlabelled } = recorded().analysis;
  expect(source).toBe("recorded");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(unlabelled)));
  render(<RefinerApp access={access} />);
  chooseLive();
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  await screen.findByText("Recorded example", {
    selector: ".source-notice strong",
  });
  expect(screen.queryByText("Live output")).toBeNull();
});

it("falls back to recorded examples when the live quota is used up", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error:
            "You have used today's 3 free live runs. They reset at 00:00 UTC.",
          code: "live_quota_exceeded",
          fallback: "demo",
          retryAfterSeconds: 3600,
        },
        { status: 429 },
      ),
    ),
  );
  render(<RefinerApp access={access} />);
  chooseLive("My own idea that should survive the fallback.");
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  await screen.findByText("Switched to recorded examples.");
  expect(screen.getByText(/used today's 3 free live runs/)).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: /Recorded example/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: /Walk through example/ }),
  ).toBeTruthy();
  // Switching back restores the visitor's own idea.
  fireEvent.click(screen.getByRole("radio", { name: /Live with Luna/ }));
  expect(
    screen.getByDisplayValue("My own idea that should survive the fallback."),
  ).toBeTruthy();
});

it("offers a recorded example and a key field when the quota runs out mid-run", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ...recorded().analysis, source: "live" }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: "Today's shared live runs are used up.",
            code: "live_quota_exceeded",
            fallback: "demo",
          },
          { status: 429 },
        ),
      ),
  );
  render(<RefinerApp access={access} />);
  chooseLive();
  fireEvent.click(screen.getByRole("button", { name: /Analyze requirements/ }));
  const field = await screen.findByLabelText(
    readingListExample.analysis.questions[0].question,
  );
  expect(screen.getByText("Live output")).toBeTruthy();
  fireEvent.change(field, { target: { value: "Session only." } });
  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("Session only.")).toBeTruthy();
  expect(screen.getByLabelText(/Your OpenAI API key/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Explore a recorded example instead" }),
  );
  expect(
    screen.getByRole("button", { name: /Walk through example/ }),
  ).toBeTruthy();
});

it("sends a visitor's own key only in a header with live requests", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ ...recorded().analysis, source: "live" }),
    )
    .mockResolvedValueOnce(
      Response.json({ ...recorded().specification, source: "live" }),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<RefinerApp access={{ ...access, hostedLive: false }} />);
  chooseLive();
  const submit = screen.getByRole("button", {
    name: /Analyze requirements/,
  }) as HTMLButtonElement;
  // Without hosted live runs, a key is required.
  expect(submit.disabled).toBe(true);
  const key = screen.getByLabelText(/Your OpenAI API key/) as HTMLInputElement;
  expect(key.type).toBe("password");
  fireEvent.change(key, { target: { value: VISITOR_KEY } });
  fireEvent.click(submit);
  const field = await screen.findByLabelText(
    readingListExample.analysis.questions[0].question,
  );
  fireEvent.change(field, { target: { value: "Session only." } });
  fireEvent.click(
    screen.getByRole("button", { name: /Generate specification/ }),
  );
  await screen.findByRole("heading", { name: "Reading list" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const call of fetchMock.mock.calls) {
    expect(headersOf(call)["X-OpenAI-Key"]).toBe(VISITOR_KEY);
    expect((call[1] as RequestInit).body).not.toContain(VISITOR_KEY);
    expect(bodyOf(call).mode).toBe("live");
  }
});

it("disables live mode when the deployment is demo-only", () => {
  render(
    <RefinerApp
      access={{
        hostedLive: false,
        visitorKey: false,
        demoOnly: true,
        perIpLimit: 3,
      }}
    />,
  );
  const live = screen.getByRole("radio", {
    name: /Live with Luna/,
  }) as HTMLInputElement;
  expect(live.disabled).toBe(true);
  expect(screen.getByText("Switched off on this deployment")).toBeTruthy();
  expect(screen.queryByLabelText(/Your OpenAI API key/)).toBeNull();
});
