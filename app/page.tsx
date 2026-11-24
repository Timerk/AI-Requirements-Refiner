import type { CSSProperties } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { publicAccess, readAccessConfig } from "@/lib/access/config";
import { readingListExample as example } from "@/lib/demo/examples/readingList";

// Everything quoted on this page comes from the recorded reading-list run,
// the same data the app serves in demo mode.
const [storage, finished] = example.analysis.questions;
const answer = example.answers[storage.id];
const spec = example.specification.finalSpecification;
const requirement = spec.functionalRequirements[0];
const task = spec.implementationTasks[0];

const STEPS = [
  {
    title: "Describe",
    body: "Write the idea the way you would say it. One sentence is enough.",
  },
  {
    title: "Clarify",
    body: "Luna lists what is unclear, a second call challenges that list, and you answer what matters.",
  },
  {
    title: "Specification",
    body: "Get scope, requirements, acceptance criteria and tasks, reviewed once more before you see them.",
  },
];

/** Animation order for one beat of the hero's markup sequence. */
const beat = (order: number) => ({ "--beat": order }) as CSSProperties;

/** What a live run costs the visitor here, in the app's own terms. */
function liveOffer() {
  const access = publicAccess(readAccessConfig());
  if (access.demoOnly) return null;
  if (access.hostedLive) {
    const runs =
      access.perIpLimit === 1 ? "1 free run" : `${access.perIpLimit} free runs`;
    return `${runs} with Luna per day, or use your own OpenAI API key.`;
  }
  return "Live runs here use your own OpenAI API key.";
}

export default async function Home() {
  // Live access depends on deployment flags, so read them per request.
  await connection();
  const live = liveOffer();
  return (
    <div className="lp">
      <header className="lp-header">
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
        <a
          className="lp-quiet-link"
          href="https://github.com/Timerk/AI-Requirements-Refiner"
        >
          Source on GitHub
        </a>
      </header>

      <main>
        <figure className="lp-markup">
          <blockquote className="lp-idea">
            <p>
              <span className="lp-quote" aria-hidden="true">
                “
              </span>
              Build a{" "}
              <mark className="lp-mark" style={beat(0)}>
                local
              </mark>
              <sup className="lp-ref" style={beat(0)}>
                {storage.id}
              </sup>{" "}
              <mark className="lp-mark lp-mark-open" style={beat(1)}>
                reading list
              </mark>
              <sup className="lp-ref" style={beat(1)}>
                {finished.id}
              </sup>{" "}
              for my books.
              <span aria-hidden="true">”</span>
            </p>
          </blockquote>

          <figcaption className="lp-notes">
            <div className="lp-note" style={beat(2)}>
              <p className="lp-note-meta">
                <span className="lp-id">{storage.id}</span> Required
              </p>
              <p className="lp-note-question">{storage.question}</p>
              <p className="lp-note-answer" style={beat(4)}>
                You answered: {answer}
              </p>
            </div>
            <div className="lp-note" style={beat(3)}>
              <p className="lp-note-meta">
                <span className="lp-id">{finished.id}</span> Optional, added in
                review
              </p>
              <p className="lp-note-question">{finished.question}</p>
              <p className="lp-note-open" style={beat(5)}>
                Not answered, so the spec keeps it as an open question.
              </p>
            </div>
          </figcaption>
        </figure>

        <section className="lp-intro" aria-labelledby="lp-title">
          <div className="lp-intro-copy">
            <h1 id="lp-title">
              Turn a rough idea into a specification you can build.
            </h1>
            <p className="lp-lede">
              Requirements Refiner finds the vague parts of your idea, asks
              about them, and lets you decide. What you leave open stays open,
              instead of being guessed.
            </p>
            {live ? (
              <div className="lp-actions">
                <div className="lp-action">
                  <Link className="lp-cta" href="/refine?mode=live">
                    Refine your own idea
                  </Link>
                  <p className="lp-fineprint">{live}</p>
                </div>
                <div className="lp-action">
                  <Link className="lp-cta lp-cta-quiet" href="/refine">
                    Try a recorded example
                  </Link>
                  <p className="lp-fineprint">
                    No API key needed. Never calls a model.
                  </p>
                </div>
              </div>
            ) : (
              <div className="lp-actions">
                <div className="lp-action">
                  <Link className="lp-cta" href="/refine">
                    Try a recorded example
                  </Link>
                  <p className="lp-fineprint">
                    Live runs are switched off here. Recorded examples never
                    call a model.
                  </p>
                </div>
              </div>
            )}
          </div>
          <ol className="lp-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-trace" aria-labelledby="lp-trace-title">
          <div className="lp-trace-head">
            <h2 id="lp-trace-title">Every part points back to a requirement</h2>
            <p>
              Every specification is checked before you see it. Each requirement
              needs an acceptance criterion and a task, and nothing may point at
              a requirement that does not exist.
            </p>
          </div>
          <div className="lp-trace-row">
            <div className="lp-trace-col">
              <p className="lp-trace-kind">Requirement</p>
              <p className="lp-id">{requirement.id}</p>
              <p>{requirement.description}</p>
            </div>
            <div className="lp-trace-col">
              <p className="lp-trace-kind">Acceptance criteria</p>
              {spec.acceptanceCriteria.map((criterion) => (
                <div key={criterion.id} className="lp-trace-item">
                  <p className="lp-id">{criterion.id}</p>
                  <p>{criterion.criterion}</p>
                  <p className="lp-trace-link">
                    verifies {criterion.requirementId}
                  </p>
                </div>
              ))}
            </div>
            <div className="lp-trace-col">
              <p className="lp-trace-kind">Task</p>
              <p className="lp-id">{task.id}</p>
              <p>{task.title}</p>
              <p className="lp-trace-link">
                implements {task.requirementIds.join(", ")}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
