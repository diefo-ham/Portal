import type { Filters as FilterValues, StudyData } from "../core/model";
import { filterQuestions } from "../core/practice";
import { reviewQueues, sessionOutcomes } from "../core/review";
import { Filters } from "./Filters";

export function Home({
  data,
  value,
  onChange,
  limit,
  setLimit,
  busy,
  protectTests,
  onStart,
  onResume,
  onReview,
  onBrowse,
  onSample,
}: {
  data: StudyData;
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  limit: number;
  setLimit: (limit: number) => void;
  busy: boolean;
  protectTests: boolean;
  onStart: (ids: string[], size: number) => void;
  onResume: (id: string) => void;
  onReview: () => void;
  onBrowse: () => void;
  onSample: () => void;
}) {
  const ongoing = data.sessions.findLast((s) => !s.finishedAt);
  const questions = filterQuestions(data, value);
  const queues = reviewQueues(data, protectTests);
  const reset = () =>
    onChange({
      section: "",
      domain: "",
      skill: "",
      difficulty: "",
      status: "",
      bookmark: "",
      search: "",
      active: protectTests ? "hide" : "include",
      domains: [],
      skills: [],
    });
  return (
    <main className="page home-page">
      <p className="eyebrow">YOUR PRACTICE</p>
      <h1>What would you like to work on?</h1>
      <p className="muted">
        Choose a focus, settle in, and take it one question at a time.
      </p>
      {ongoing && (
        <section className="resume-strip">
          <div>
            <strong>Continue where you left off.</strong>
            <span>
              {ongoing.questionIds.length -
                sessionOutcomes(data, ongoing).unanswered.length}{" "}
              answered · {sessionOutcomes(data, ongoing).unanswered.length} left
              in your session
            </span>
          </div>
          <button onClick={() => onResume(ongoing.id)}>
            Resume practice →
          </button>
        </section>
      )}
      {!data.questions.length ? (
        <section className="empty-state">
          <h2>Your practice space is ready.</h2>
          <p>
            No local question library is available yet. Try the original
            examples to get started.
          </p>
          <button className="primary" disabled={busy} onClick={onSample}>
            Load synthetic sample
          </button>
        </section>
      ) : (
        <>
          <section
            className="practice-composer"
            aria-label="Practice selection"
          >
            <div className="section-heading">
              <h2>Choose your focus</h2>
              <button className="text-button" onClick={reset}>
                Reset filters
              </button>
            </div>
            <Filters data={data} value={value} onChange={onChange} compact />
            <details className="refine-selection">
              <summary>
                Refine selection
                {value.skills?.length ||
                value.difficulty ||
                value.bookmark ||
                value.active !== (protectTests ? "hide" : "include")
                  ? " · customized"
                  : ""}
              </summary>
              <Filters data={data} value={value} onChange={onChange} advanced />
            </details>
            {value.search && (
              <p className="small muted">
                Search carried over from Browse: {value.search}{" "}
                <button
                  className="text-button"
                  onClick={() => onChange({ ...value, search: "" })}
                >
                  Clear search
                </button>
              </p>
            )}
            <div className="composer-start">
              <label>
                Session size
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {[5, 10, 20, 0].map((n) => (
                    <option key={n} value={n}>
                      {n || "All"} questions
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={busy || !questions.length}
                onClick={() =>
                  onStart(
                    questions.map((q) => q.id),
                    limit,
                  )
                }
              >
                Start practice →
              </button>
              <span className="small muted">
                {questions.length} questions available
              </span>
            </div>
            {!questions.length && (
              <p className="muted small">
                No questions match this combination. Broaden your focus or reset
                the filters.
              </p>
            )}
            {ongoing && (
              <p className="small muted">
                Starting a new set closes the current session. Unanswered
                questions remain available in Review.
              </p>
            )}
          </section>
          {(queues.mistakes.length > 0 || queues.unanswered.length > 0) && (
            <section className="gentle-review">
              <h2>Something to revisit</h2>
              <p className="muted">
                {queues.mistakes.length > 0
                  ? `${queues.mistakes.length} questions could use another attempt. `
                  : ""}
                {queues.unanswered.length > 0
                  ? `${queues.unanswered.length} questions from your practice sets are still unanswered.`
                  : ""}
              </p>
              <button className="text-button" onClick={onReview}>
                See what’s waiting in Review →
              </button>
            </section>
          )}
          <button className="text-button browse-link" onClick={onBrowse}>
            Browse individual questions →
          </button>
        </>
      )}
    </main>
  );
}
