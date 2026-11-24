import type { PublicAccess } from "@/lib/access/config";
import type { DemoExample } from "@/lib/demo/examples";
import { LUNA_MODEL } from "@/lib/llm/model";

export type RunMode = "demo" | "live";

const complexityLabels = {
  prototype: "Prototype",
  small_application: "Small application",
  production_system: "Production system",
} as const;

export function ApiKeyField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required: boolean;
}) {
  return (
    <div className="api-key-field">
      <div className="field-heading">
        <label htmlFor="api-key">
          Your OpenAI API key{required ? "" : " (optional)"}
        </label>
        <span className="field-note">
          {required ? "Required for live runs here" : "Skips the shared daily limit"}
        </span>
      </div>
      <input
        id="api-key"
        name="api-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="api-key-help"
      />
      <p id="api-key-help" className="field-help">
        Sent only with your requests to this app’s server and used for that
        request. It is never stored, logged, or returned. Usage is billed to
        your OpenAI account.
      </p>
    </div>
  );
}

export function RunModePicker({
  access,
  mode,
  onModeChange,
  examples,
  exampleId,
  onExampleChange,
  apiKey,
  onApiKeyChange,
}: {
  access: PublicAccess;
  mode: RunMode;
  onModeChange: (mode: RunMode) => void;
  examples: readonly DemoExample[];
  exampleId: string;
  onExampleChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}) {
  const liveSelectable = access.hostedLive || access.visitorKey;
  const liveDetail = access.demoOnly
    ? "Switched off on this deployment"
    : access.hostedLive
      ? `${access.perIpLimit} free runs per visitor per day, or use your own key`
      : "Bring your own OpenAI API key";
  return (
    <section className="run-mode" aria-label="Run mode">
      <fieldset>
        <legend>How do you want to try it?</legend>
        <div className="project-types mode-options">
          <label className={`project-type ${mode === "demo" ? "selected" : ""}`}>
            <input
              type="radio"
              name="mode"
              value="demo"
              checked={mode === "demo"}
              onChange={() => onModeChange("demo")}
            />
            <span>
              <strong>Recorded example</strong>
              <small>Free and instant. No model is called.</small>
            </span>
          </label>
          <label
            className={`project-type ${mode === "live" ? "selected" : ""} ${liveSelectable ? "" : "disabled"}`}
          >
            <input
              type="radio"
              name="mode"
              value="live"
              checked={mode === "live"}
              disabled={!liveSelectable}
              onChange={() => onModeChange("live")}
            />
            <span>
              <strong>Live with Luna</strong>
              <small>{liveDetail}</small>
            </span>
          </label>
        </div>
      </fieldset>
      {mode === "demo" && (
        <fieldset>
          <legend>Choose an example</legend>
          <div className="project-types example-options">
            {examples.map((example) => (
              <label
                key={example.id}
                className={`project-type ${exampleId === example.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="example"
                  value={example.id}
                  checked={exampleId === example.id}
                  onChange={() => onExampleChange(example.id)}
                />
                <span>
                  <strong>{example.title}</strong>
                  <small>
                    {complexityLabels[example.idea.complexity]} ·{" "}
                    {example.summary}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {mode === "live" && access.visitorKey && (
        <ApiKeyField
          value={apiKey}
          onChange={onApiKeyChange}
          required={!access.hostedLive}
        />
      )}
    </section>
  );
}

export function SourceNotice({
  source,
  exampleTitle,
}: {
  source: "recorded" | "live";
  exampleTitle?: string;
}) {
  return source === "recorded" ? (
    <div className="source-notice recorded" role="note">
      <strong>Recorded example</strong>
      <span>
        Prepared in advance{exampleTitle ? ` for “${exampleTitle}”` : ""}. No
        model was called, and changing the answers does not change the output.
        This is not live output.
      </span>
    </div>
  ) : (
    <div className="source-notice live" role="note">
      <strong>Live output</strong>
      <span>Generated for your input by {LUNA_MODEL}.</span>
    </div>
  );
}
