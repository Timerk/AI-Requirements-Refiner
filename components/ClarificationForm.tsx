import type { FormEvent } from "react";
import type { Question } from "@/lib/schemas/analysis";

export function ClarificationForm({
  questions,
  answers,
  onChange,
  onSubmit,
  onBack,
}: {
  questions: Question[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={submit}>
      <div className="section-heading">
        <h2>
          {questions.length
            ? `${questions.length} decisions to clarify`
            : "Your idea has enough detail"}
        </h2>
        <p>
          {questions.length
            ? "Answer the required questions. If you are unsure, say so; it will remain an open decision."
            : "The reviewer has no further questions. You can generate the specification now."}
        </p>
      </div>
      <div className="questions">
        {questions.map((question, index) => (
          <div className="question" key={question.id}>
            <div className="question-meta">
              <span>
                {String(index + 1).padStart(2, "0")} / {question.category}
              </span>
              <span
                className={`badge ${question.importance === "required" ? "required" : ""}`}
              >
                {question.importance}
              </span>
            </div>
            <label htmlFor={`answer-${question.id}`}>{question.question}</label>
            <p id={`reason-${question.id}`}>{question.reason}</p>
            <textarea
              id={`answer-${question.id}`}
              name={question.id}
              rows={3}
              maxLength={6000}
              required={question.importance === "required"}
              aria-describedby={`reason-${question.id}`}
              value={answers[question.id] ?? ""}
              onChange={(event) => onChange(question.id, event.target.value)}
              placeholder="Your decision…"
            />
          </div>
        ))}
      </div>
      <div className="form-footer">
        <button className="secondary" type="button" onClick={onBack}>
          ← Edit idea
        </button>
        <button className="primary" type="submit">
          Generate specification <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
