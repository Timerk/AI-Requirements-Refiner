import type { AnalysisResult } from "@/lib/schemas/contracts";

export function AnalysisSummary({ result }: { result: AnalysisResult }) {
  const addedCount = result.review.addedQuestions.length;
  const challengedCount = result.review.challengedAssumptions.length;

  return (
    <section className="analysis-summary" aria-label="Analysis summary">
      <div className="eyebrow">Our understanding</div>
      <p className="understood-goal">{result.analysis.understoodGoal}</p>
      <div className="review-stats">
        <span>
          <strong>{addedCount}</strong>{" "}
          {addedCount === 1 ? "question added" : "questions added"}
        </span>
        <span>
          <strong>{result.review.removedQuestionIds.length}</strong> removed
        </span>
        <span>
          <strong>{challengedCount}</strong>{" "}
          {challengedCount === 1
            ? "assumption challenged"
            : "assumptions challenged"}
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
