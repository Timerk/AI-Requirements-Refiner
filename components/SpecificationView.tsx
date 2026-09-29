import { useState } from "react";
import type { SpecificationResult } from "@/lib/schemas/contracts";
import { specificationToMarkdown } from "@/lib/markdown";
import { ReviewSummary } from "./ReviewSummary";

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="spec-section">
      <h2>{title}</h2>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">None specified.</p>
      )}
    </section>
  );
}

export function SpecificationView({
  result,
  onBack,
  onReset,
}: {
  result: SpecificationResult;
  onBack: () => void;
  onReset: () => void;
}) {
  const [notice, setNotice] = useState("");
  const spec = result.finalSpecification;
  const markdown = specificationToMarkdown(spec);
  async function copy(text: string, name: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${name} copied.`);
    } catch {
      setNotice(
        "Clipboard unavailable. Download the Markdown file or select the text to copy it.",
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      spec.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60)
        .replace(/^-|-$/g, "") || "project"
    }-specification.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Markdown download started.");
  }
  return (
    <>
      <div className="result-toolbar">
        <button
          className="primary"
          onClick={() => copy(markdown, "Specification")}
        >
          Copy specification
        </button>
        <button className="secondary" onClick={download}>
          Download .md <span aria-hidden="true">↓</span>
        </button>
        <button className="text-button" onClick={onBack}>
          Edit answers
        </button>
      </div>
      <p className="copy-notice" role="status">
        {notice}
      </p>
      <ReviewSummary result={result} />
      <article className="specification">
        <div className="eyebrow">Final specification</div>
        <h2 className="project-name">{spec.projectName}</h2>
        <p className="spec-goal">{spec.goal}</p>
        {spec.unresolvedQuestions.length > 0 && (
          <div className="open-decisions">
            <strong>
              {spec.unresolvedQuestions.length} open decisions remain.
            </strong>{" "}
            Resolve them before implementing dependent tasks.
          </div>
        )}
        <TextList title="Scope" items={spec.scope} />
        <TextList title="Out of scope" items={spec.outOfScope} />
        <TextList title="Users" items={spec.users} />
        {[
          {
            title: "Functional requirements",
            items: spec.functionalRequirements,
          },
          {
            title: "Nonfunctional requirements",
            items: spec.nonFunctionalRequirements,
          },
        ].map(({ title, items }) => (
          <section className="spec-section" key={title}>
            <h2>{title}</h2>
            {items.length ? (
              items.map((item) => (
                <div className="requirement" key={item.id}>
                  <span className="id-label">{item.id}</span>
                  <p>{item.description}</p>
                </div>
              ))
            ) : (
              <p className="muted">None specified.</p>
            )}
          </section>
        ))}
        <TextList
          title="Technology constraints"
          items={spec.technologyConstraints}
        />
        <TextList title="Data requirements" items={spec.dataRequirements} />
        <section className="spec-section">
          <h2>Acceptance criteria</h2>
          {spec.acceptanceCriteria.map((item) => (
            <div className="requirement" key={item.id}>
              <span className="id-label">
                {item.id}
                <small>→ {item.requirementId}</small>
              </span>
              <p>{item.criterion}</p>
            </div>
          ))}
        </section>
        <TextList title="Edge cases" items={spec.edgeCases} />
        <TextList title="Assumptions" items={spec.assumptions} />
        <TextList
          title="Unresolved questions"
          items={spec.unresolvedQuestions}
        />
        <section className="spec-section">
          <h2>Implementation tasks</h2>
          {spec.implementationTasks.map((task) => (
            <article className="task" key={task.id}>
              <span className="id-label">{task.id}</span>
              <h3>{task.title}</h3>
              <p>{task.description}</p>
              <p className="muted">
                Requirements: {task.requirementIds.join(", ")}
                <br />
                Depends on: {task.dependencies.join(", ") || "None"}
              </p>
            </article>
          ))}
        </section>
        <section className="spec-section">
          <div className="field-heading">
            <h2>Coding-agent prompt</h2>
            <button
              className="secondary"
              onClick={() => copy(spec.implementationPrompt, "Agent prompt")}
            >
              Copy agent prompt
            </button>
          </div>
          <pre className="agent-prompt">{spec.implementationPrompt}</pre>
        </section>
        <details>
          <summary>View the original draft</summary>
          <pre className="draft">{specificationToMarkdown(result.draft)}</pre>
        </details>
      </article>
      <div className="form-footer">
        <p>
          This project stays in this tab until you leave.
          <br />
          Export it before starting another.
        </p>
        <button className="secondary" onClick={onReset}>
          Start another project ↗
        </button>
      </div>
    </>
  );
}
