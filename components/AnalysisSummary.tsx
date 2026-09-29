import type { AnalysisResult } from "@/lib/schemas/contracts";

export function AnalysisSummary({ result }: { result: AnalysisResult }) {
  return (
    <section className="analysis-summary" aria-label="Analysis summary">
      <div className="eyebrow">Our understanding</div>
      <p className="understood-goal">{result.analysis.understoodGoal}</p>
      <div className="review-stats">
        <span>
          <strong>{result.review.addedQuestions.length}</strong> questions added
        </span>
        <span>
          <strong>{result.review.removedQuestionIds.length}</strong> removed
        </span>
        <span>
          <strong>{result.review.challengedAssumptions.length}</strong>{" "}
          assumptions challenged
        </span>
      </div>
      <details>
        <summary>Read the analysis and separate review</summary>
        <h3>Luna review</h3>
        <p>{result.review.assessment}</p>
        {[
          { title: "Known facts", items: result.analysis.knownFacts },
          {
            title: "Initial assumptions · unconfirmed",
            items: result.analysis.assumptions,
          },
          { title: "Ambiguities", items: result.analysis.ambiguities },
          {
            title: "Challenged assumptions",
            items: result.review.challengedAssumptions,
          },
          { title: "Missing topics", items: result.review.missingTopics },
        ].map(({ title, items }) =>
          items.length > 0 ? (
            <div key={title}>
              <h3>{title}</h3>
              <ul>
                {items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </details>
    </section>
  );
}
