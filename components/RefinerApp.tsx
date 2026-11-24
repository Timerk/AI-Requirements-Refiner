"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { IdeaInput } from "@/components/IdeaInput";
import { StepIndicator } from "@/components/StepIndicator";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { ClarificationForm } from "@/components/ClarificationForm";
import { SpecificationView } from "@/components/SpecificationView";
import {
  ApiKeyField,
  RunModePicker,
  SourceNotice,
  type RunMode,
} from "@/components/RunModePicker";
import type { PublicAccess } from "@/lib/access/config";
import { demoExamples, findDemoExample } from "@/lib/demo/examples";
import {
  AnalysisResultSchema,
  SpecificationInputSchema,
  SpecificationResultSchema,
  type AnalysisResult,
  type Idea,
  type SpecificationResult,
} from "@/lib/schemas/contracts";

type Stage = "idea" | "analyzing" | "clarification" | "generating" | "result";
type Source = "recorded" | "live";
interface Run {
  mode: RunMode;
  exampleId?: string;
  idea: Idea;
}

const ErrorResponseSchema = z.object({
  error: z.string(),
  stage: z.string().optional(),
  code: z.string().optional(),
  fallback: z.literal("demo").optional(),
  requestId: z.string().optional(),
  diagnostics: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      code: z.string().optional(),
      upstreamStatus: z.number().optional(),
    })
    .optional(),
});
const SourceSchema = z.object({ source: z.enum(["recorded", "live"]) });
const stageNames: Record<string, string> = {
  "analyze-requirements": "Requirements analysis",
  "review-requirements": "Requirements review",
  "generate-specification": "Draft specification",
  "review-specification": "Specification review",
  "finalize-specification": "Final revision",
};

class RequestError extends Error {
  constructor(
    message: string,
    public readonly fallback?: "demo",
  ) {
    super(message);
  }
}

async function post<T>(
  url: string,
  run: Run,
  body: unknown,
  schema: z.ZodType<T>,
  apiKey: string,
): Promise<{ data: T; source: Source }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // The visitor's own key travels only in this header, only for live runs.
  if (run.mode === "live" && apiKey.trim())
    headers["X-OpenAI-Key"] = apiKey.trim();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...(body as object),
        mode: run.mode,
        ...(run.mode === "demo" ? { exampleId: run.exampleId } : {}),
      }),
      signal: AbortSignal.timeout(300000),
    });
  } catch {
    throw new RequestError(
      "The server could not be reached or the request timed out. Your input is still here; please retry.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new RequestError(
      "The server returned an unreadable response. Please retry.",
    );
  }
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(data);
    if (!parsed.success)
      throw new RequestError("The request failed. Please retry.");
    const label = parsed.data.stage ? stageNames[parsed.data.stage] : undefined;
    const details = parsed.data.diagnostics;
    const diagnosticText = [
      details?.provider,
      details?.model,
      details?.upstreamStatus ? `HTTP ${details.upstreamStatus}` : undefined,
      details?.code,
    ]
      .filter(Boolean)
      .join(" · ");
    throw new RequestError(
      `${label ? `${label} failed. ` : ""}${parsed.data.error}${diagnosticText ? `\n${diagnosticText}` : ""}${parsed.data.requestId ? `\nRequest ID: ${parsed.data.requestId}` : ""}`,
      parsed.data.fallback,
    );
  }
  const result = schema.safeParse(data);
  if (!result.success)
    throw new RequestError(
      "The server returned incomplete project data. Please retry.",
    );
  const source = SourceSchema.safeParse(data);
  return {
    data: result.data,
    // Anything not explicitly marked live is never presented as live output.
    source: source.success ? source.data.source : "recorded",
  };
}

const SOURCE_URL = "https://github.com/Timerk/AI-Requirements-Refiner";
const AUTHOR_URL = "https://github.com/Timerk";

export function RefinerApp({ access }: { access: PublicAccess }) {
  const [stage, setStage] = useState<Stage>("idea");
  const [mode, setMode] = useState<RunMode>("demo");
  const [exampleId, setExampleId] = useState(demoExamples[0].id);
  const [liveIdea, setLiveIdea] = useState<Idea>({
    description: "",
    complexity: "small_application",
  });
  const [apiKey, setApiKey] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SpecificationResult | null>(null);
  const [source, setSource] = useState<Source>("recorded");
  const [error, setError] = useState("");
  const [canFallBack, setCanFallBack] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current !== stage) {
      heading.current?.focus();
      previousStage.current = stage;
    }
  }, [stage]);

  const example = findDemoExample(exampleId) ?? demoExamples[0];
  const idea = mode === "demo" ? example.idea : liveIdea;
  const runExample = run?.exampleId ? findDemoExample(run.exampleId) : undefined;
  const liveBlocked =
    mode === "live" && !access.hostedLive && !apiKey.trim();

  function showError(error: unknown, fallbackMessage: string) {
    setError(error instanceof Error ? error.message : fallbackMessage);
    setCanFallBack(error instanceof RequestError && error.fallback === "demo");
  }

  function switchToDemo(message = "") {
    setMode("demo");
    setRun(null);
    setAnalysis(null);
    setAnswers({});
    setResult(null);
    setError("");
    setCanFallBack(false);
    setNotice(message);
    setStage("idea");
  }

  async function analyze() {
    if (busy.current) return;
    const next: Run = {
      mode,
      exampleId: mode === "demo" ? example.id : undefined,
      idea,
    };
    busy.current = true;
    setError("");
    setCanFallBack(false);
    setNotice("");
    setStage("analyzing");
    try {
      const response = await post(
        "/api/analyze",
        next,
        next.idea,
        AnalysisResultSchema,
        apiKey,
      );
      setRun(next);
      setAnalysis(response.data);
      setSource(response.source);
      // Recorded output belongs to recorded answers; prefill them so the
      // walkthrough stays consistent.
      setAnswers(
        response.source === "recorded" && next.exampleId
          ? { ...findDemoExample(next.exampleId)?.answers }
          : {},
      );
      setResult(null);
      setStage("clarification");
    } catch (error) {
      setStage("idea");
      if (error instanceof RequestError && error.fallback === "demo") {
        // Quota, kill switch, or bot check: continue with a recorded example.
        switchToDemo(error.message);
      } else {
        showError(error, "Analysis failed.");
      }
    } finally {
      busy.current = false;
    }
  }

  async function generate() {
    if (!analysis || !run || busy.current) return;
    const input = SpecificationInputSchema.safeParse({
      ...run.idea,
      analysis: analysis.analysis,
      questions: analysis.questions,
      answers,
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Check your answers.");
      setCanFallBack(false);
      return;
    }
    busy.current = true;
    setError("");
    setCanFallBack(false);
    setStage("generating");
    try {
      const response = await post(
        "/api/specification",
        run,
        input.data,
        SpecificationResultSchema,
        apiKey,
      );
      setResult(response.data);
      setSource(response.source);
      setStage("result");
    } catch (error) {
      showError(error, "Specification generation failed.");
      setStage("clarification");
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    setLiveIdea({ description: "", complexity: "small_application" });
    setRun(null);
    setAnalysis(null);
    setAnswers({});
    setResult(null);
    setError("");
    setCanFallBack(false);
    setNotice("");
    setStage("idea");
  }
  const current =
    stage === "idea" || stage === "analyzing" ? 0 : stage === "result" ? 2 : 1;
  const loading = stage === "analyzing" || stage === "generating";
  const recordedRun = (run?.mode ?? mode) === "demo";
  const titles = {
    idea: (
      <>
        A rough idea.
        <br />
        <span>A clear place to start.</span>
      </>
    ),
    analyzing: (
      <>
        Finding the questions
        <br />
        <span>worth asking.</span>
      </>
    ),
    clarification: (
      <>
        Your decisions.
        <br />
        <span>A stronger specification.</span>
      </>
    ),
    generating: (
      <>
        Writing. Reviewing.
        <br />
        <span>Refining the details.</span>
      </>
    ),
    result: (
      <>
        From idea
        <br />
        <span>to implementation.</span>
      </>
    ),
  };
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link
          className="wordmark"
          href="/"
          aria-label="Requirements Refiner home"
        >
          <span className="logo" aria-hidden="true">
            r<span>↗</span>
          </span>
          <span>
            requirements<span className="wordmark-light"> / refiner</span>
          </span>
        </Link>
        <div className="header-meta">
          <span className="version">
            <span className="status-dot" />{" "}
            {recordedRun ? "DEMO · RECORDED EXAMPLES" : "LIVE · LUNA. YOUR CALL."}
          </span>
          <a
            className="header-source"
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source<span className="sr-only"> code on GitHub (opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </header>
      <main>
        <StepIndicator current={current} />
        <div className="workspace">
          <div className="main-column">
            <div className="intro">
              <div className="eyebrow">
                {stage === "result"
                  ? "03 / Your specification"
                  : current === 0
                    ? "01 / Start with an idea"
                    : "02 / Keep the human in the loop"}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {titles[stage]}
              </h1>
              <p>
                {stage === "idea"
                  ? "Turn what you have in mind into a specification you can build. A separate AI review finds the gaps. You fill them in."
                  : stage === "clarification"
                    ? "The analysis and separate review are complete. These are the decisions that matter for your project."
                    : stage === "result"
                      ? "Your specification, the review behind it, and a prompt for your coding agent."
                      : recordedRun
                        ? "Loading the recorded example."
                        : "Each stage completes before the next begins. This can take a few minutes."}
              </p>
            </div>
            {notice && (
              <div className="notice-panel" role="status">
                <strong>Switched to recorded examples.</strong>
                <p>{notice}</p>
              </div>
            )}
            {error && (
              <div className="error-panel" role="alert">
                <strong>We couldn’t complete that step.</strong>
                <p>{error}</p>
                {canFallBack && stage !== "idea" && access.visitorKey && (
                  <ApiKeyField
                    value={apiKey}
                    onChange={setApiKey}
                    required={false}
                  />
                )}
                <div className="error-actions">
                  <button
                    className="secondary"
                    onClick={stage === "idea" ? analyze : generate}
                  >
                    Retry {stage === "idea" ? "analysis" : "generation"}
                  </button>
                  {canFallBack && (
                    <button
                      className="text-button"
                      onClick={() => switchToDemo()}
                    >
                      Explore a recorded example instead
                    </button>
                  )}
                </div>
              </div>
            )}
            {stage === "idea" && (
              <>
                <RunModePicker
                  access={access}
                  mode={mode}
                  onModeChange={(next) => {
                    setMode(next);
                    setNotice("");
                    setError("");
                  }}
                  examples={demoExamples}
                  exampleId={example.id}
                  onExampleChange={setExampleId}
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                />
                <IdeaInput
                  idea={idea}
                  onChange={setLiveIdea}
                  onSubmit={analyze}
                  recorded={mode === "demo"}
                  blocked={liveBlocked}
                />
              </>
            )}
            {loading && (
              <section
                className="loading-panel"
                role="status"
                aria-live="polite"
              >
                <div className="spinner" />
                <h2>
                  {stage === "analyzing"
                    ? "Analyzing and reviewing"
                    : "Drafting, reviewing, and revising"}
                </h2>
                <p>
                  {recordedRun
                    ? "Loading the recorded output. No model is called."
                    : stage === "analyzing"
                      ? "Luna analyzes your idea, then Luna challenges the analysis."
                      : "Luna writes the draft, Luna critiques it, then Luna evaluates the feedback."}
                </p>
                <p className="muted">
                  Keep this tab open. Your input is preserved if a stage fails.
                </p>
              </section>
            )}
            {stage === "clarification" && analysis && (
              <>
                <SourceNotice
                  source={source}
                  exampleTitle={runExample?.title}
                />
                <AnalysisSummary result={analysis} />
                <ClarificationForm
                  questions={analysis.questions}
                  answers={answers}
                  onChange={(id, value) =>
                    setAnswers((previous) => ({ ...previous, [id]: value }))
                  }
                  onSubmit={generate}
                  onBack={() => {
                    setError("");
                    setCanFallBack(false);
                    setStage("idea");
                  }}
                />
              </>
            )}
            {stage === "result" && result && (
              <>
                <SourceNotice
                  source={source}
                  exampleTitle={runExample?.title}
                />
                <SpecificationView
                  result={result}
                  recorded={source === "recorded"}
                  onBack={() => {
                    setError("");
                    setCanFallBack(false);
                    setStage("clarification");
                  }}
                  onReset={reset}
                />
              </>
            )}
          </div>
          <aside className="workflow-aside">
            <div className="eyebrow">A second perspective built in</div>
            <h2>
              Good specs start
              <br />
              with better questions.
            </h2>
            <div className="workflow-track">
              <div>
                <span>01</span>
                <h3>Analyze & challenge</h3>
                <p>
                  Luna finds gaps in your idea. Luna takes a second
                  look.
                </p>
                <small>{current > 0 ? "✓ COMPLETE" : "LUNA → REVIEW"}</small>
              </div>
              <div>
                <span>02</span>
                <h3>You decide</h3>
                <p>
                  Clarify what matters. Keep uncertain decisions out in the
                  open.
                </p>
                <small>
                  {current === 2 ? "✓ COMPLETE" : "HUMAN CLARIFICATION"}
                </small>
              </div>
              <div>
                <span>03</span>
                <h3>Write, review, refine</h3>
                <p>
                  A structured specification, reviewed in a separate Luna call and
                  revised by the author.
                </p>
                <small>
                  {current === 2 ? "✓ COMPLETE" : "LUNA → REVIEW → REVISION"}
                </small>
              </div>
            </div>
            <div className="aside-note">
              <span aria-hidden="true">↳</span>
              <p>
                Your requirements stay yours.
                <br />
                Reviewer suggestions don’t override your decisions.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <footer className="site-footer">
        <span>Less guessing. More building.</span>
        <span>No saved history · Export before you leave</span>
        <nav className="footer-links" aria-label="Project links">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
          <span aria-hidden="true">·</span>
          <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
            Built by Timerk
            <span className="sr-only"> (GitHub profile, opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </nav>
      </footer>
    </div>
  );
}
