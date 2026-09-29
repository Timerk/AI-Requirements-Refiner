import type { SpecificationResult } from "@/lib/schemas/contracts";

export function ReviewSummary({ result }: { result: SpecificationResult }) {
  return (
    <section className="review-summary">
      <div className="eyebrow">Draft review</div>
      <h2>
        {result.review.verdict === "approved"
          ? "Luna approved the draft"
          : `${result.review.issues.length} review findings considered`}
      </h2>
      <p>{result.review.summary}</p>
      <p className="muted">
        Luna produced the final revision below. Its reported changes have not
        been reviewed again by Luna.
      </p>
      {result.review.issues.length > 0 && (
        <details>
          <summary>See feedback and revision decisions</summary>
          <div className="review-issues">
            {result.review.issues.map((issue, index) => {
              const decision = result.reviewDecisions.find(
                (item) => item.issueIndex === index,
              );
              return (
                <article key={index}>
                  <div className="question-meta">
                    <span>{issue.category.replaceAll("_", " ")}</span>
                    <span
                      className={`badge ${issue.severity === "critical" || issue.severity === "high" ? "required" : ""}`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <h3>{issue.description}</h3>
                  <p>{issue.recommendedChange}</p>
                  {decision && (
                    <p>
                      <strong>Editor: {decision.disposition}.</strong>{" "}
                      {decision.reason}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
