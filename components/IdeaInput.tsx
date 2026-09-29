import type { FormEvent } from "react";
import type { Idea } from "@/lib/schemas/contracts";

const projectTypes = [
  { value: "prototype", title: "Prototype", detail: "Explore an idea" },
  {
    value: "small_application",
    title: "Small application",
    detail: "Build a focused tool",
  },
  {
    value: "production_system",
    title: "Production system",
    detail: "Plan for real operations",
  },
] as const;

export function IdeaInput({
  idea,
  onChange,
  onSubmit,
}: {
  idea: Idea;
  onChange: (idea: Idea) => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={submit} className="idea-form">
      <div className="field-heading">
        <label htmlFor="description">What do you want to build?</label>
        <span className="field-note">Start with the rough version</span>
      </div>
      <textarea
        id="description"
        name="description"
        rows={8}
        required
        minLength={10}
        maxLength={12000}
        value={idea.description}
        onChange={(event) =>
          onChange({ ...idea, description: event.target.value })
        }
        placeholder="I want to build an application that…"
        aria-describedby="idea-help"
      />
      <div className="input-meta">
        <span id="idea-help">Who is it for? What should it help them do?</span>
        <span>{idea.description.length.toLocaleString()} / 12,000</span>
      </div>
      <fieldset>
        <legend>How far do you want to take it?</legend>
        <div className="project-types">
          {projectTypes.map((type) => (
            <label
              className={`project-type ${idea.complexity === type.value ? "selected" : ""}`}
              key={type.value}
            >
              <input
                type="radio"
                name="complexity"
                value={type.value}
                checked={idea.complexity === type.value}
                onChange={() => onChange({ ...idea, complexity: type.value })}
              />
              <span>
                <strong>{type.title}</strong>
                <small>{type.detail}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-footer">
        <p>
          Luna analyzes and reviews the idea.
          <br />
          You make the decisions.
        </p>
        <button
          className="primary"
          type="submit"
          disabled={idea.description.trim().length < 10}
        >
          Analyze requirements <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
