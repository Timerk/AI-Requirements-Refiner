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
  AnalysisResultSchema,
  SpecificationInputSchema,
  SpecificationResultSchema,
  type AnalysisResult,
  type Idea,
  type SpecificationResult,
} from "@/lib/schemas/contracts";

type Stage = "idea" | "analyzing" | "clarification" | "generating" | "result";
const ErrorResponseSchema = z.object({
  error: z.string(),
  stage: z.string().optional(),
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
const stageNames: Record<string, string> = {
  "analyze-requirements": "Requirements analysis",
  "review-requirements": "Requirements review",
  "generate-specification": "Draft specification",
  "review-specification": "Specification review",
  "finalize-specification": "Final revision",
};

async function post<T>(
  url: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });
  } catch {
    throw new Error(
      "The server could not be reached or the request timed out. Your input is still here; please retry.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Please retry.",
    );
  }
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(data);
    if (!parsed.success) throw new Error("The request failed. Please retry.");
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
    throw new Error(
      `${label ? `${label} failed. ` : ""}${parsed.data.error}${diagnosticText ? `\n${diagnosticText}` : ""}${parsed.data.requestId ? `\nRequest ID: ${parsed.data.requestId}` : ""}`,
    );
  }
  const result = schema.safeParse(data);
  if (!result.success)
    throw new Error(
      "The server returned incomplete project data. Please retry.",
    );
  return result.data;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("idea");
  const [idea, setIdea] = useState<Idea>({
    description: "",
    complexity: "small_application",
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SpecificationResult | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current !== stage) {
      heading.current?.focus();
      previousStage.current = stage;
    }
  }, [stage]);

  async function analyze() {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setStage("analyzing");
    try {
      const next = await post("/api/analyze", idea, AnalysisResultSchema);
      setAnalysis(next);
      setAnswers({});
      setResult(null);
      setStage("clarification");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Analysis failed.");
      setStage("idea");
    } finally {
      busy.current = false;
    }
  }

  async function generate() {
    if (!analysis || busy.current) return;
    const input = SpecificationInputSchema.safeParse({
      ...idea,
      analysis: analysis.analysis,
      questions: analysis.questions,
      answers,
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Check your answers.");
      return;
    }
    busy.current = true;
    setError("");
    setStage("generating");
    try {
      setResult(
        await post("/api/specification", input.data, SpecificationResultSchema),
      );
      setStage("result");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Specification generation failed.",
      );
      setStage("clarification");
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    setIdea({ description: "", complexity: "small_application" });
    setAnalysis(null);
    setAnswers({});
    setResult(null);
    setError("");
    setStage("idea");
  }
  const current =
    stage === "idea" || stage === "analyzing" ? 0 : stage === "result" ? 2 : 1;
  const loading = stage === "analyzing" || stage === "generating";
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
        <span className="version">
          <span className="status-dot" /> LUNA. YOUR CALL.
        </span>
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
                      : "Each stage completes before the next begins. This can take a few minutes."}
              </p>
            </div>
            {error && (
              <div className="error-panel" role="alert">
                <strong>We couldn’t complete that step.</strong>
                <p>{error}</p>
                <button
                  className="secondary"
                  onClick={stage === "idea" ? analyze : generate}
                >
                  Retry {stage === "idea" ? "analysis" : "generation"}
                </button>
              </div>
            )}
            {stage === "idea" && (
              <IdeaInput idea={idea} onChange={setIdea} onSubmit={analyze} />
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
                  {stage === "analyzing"
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
                    setStage("idea");
                  }}
                />
              </>
            )}
            {stage === "result" && result && (
              <SpecificationView
                result={result}
                onBack={() => {
                  setError("");
                  setStage("clarification");
                }}
                onReset={reset}
              />
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
      </footer>
    </div>
  );
}
