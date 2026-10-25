import { useState } from "react";
import { useQuestionTimer } from "./useQuestionTimer";
import { submitAnswer, finishSession } from "../core/commands";
import type { Question, Session, StudyData } from "../core/model";
import { numericValue } from "../core/practice";
import { sectionName } from "./Filters";
import { Calculator } from "../calculator/Calculator";
type Mutate = (fn: (d: StudyData) => void) => Promise<StudyData>;
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export function Practice({
  data,
  session,
  mutate,
  onBack,
  onRetry,
}: {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
  onRetry: (ids: string[]) => void;
}) {
  const question = data.questions.find(
    (q) => q.id === session.questionIds[session.index],
  )!;
  const attempt = data.attempts.find(
    (a) => a.questionId === question.id && a.sessionId === session.id,
  );
  const [pending, setPending] = useState(false);
  const [calculator, setCalculator] = useState(true);
  const [draft, setDraft] = useState<{ id: string; value: string }>();
  const [noteDraft, setNoteDraft] = useState<{ id: string; value: string }>();
  const timer = useQuestionTimer(
    session.id,
    question.id,
    !session.paused && !session.finishedAt && !attempt,
    mutate,
  );
  const answer =
    draft?.id === question.id ? draft.value : session.drafts[question.id] || "";
  const annotation = data.annotations[question.id] || {
    bookmarked: false,
    note: "",
  };
  const note =
    noteDraft?.id === question.id ? noteDraft.value : annotation.note;
  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      await fn();
    } catch {
      /* global error banner */
    } finally {
      setPending(false);
    }
  };
  const navigate = (index: number) =>
    run(async () => {
      await timer.flush();
      await mutate((d) => {
        d.sessions.find((s) => s.id === session.id)!.index = index;
      });
    });
  const submit = () =>
    run(async () => {
      await timer.flush();
      await mutate((d) => submitAnswer(d, session.id, question.id, answer));
    });
  const finish = () =>
    run(async () => {
      await timer.flush();
      await mutate((d) => finishSession(d, session.id));
    });
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  const missed = attempts.filter((a) => !a.correct).map((a) => a.questionId);
  if (session.finishedAt)
    return (
      <main className="page narrow">
        <button className="text-button" onClick={onBack}>
          ← Back to library
        </button>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h1>A little practice, a clearer picture.</h1>
        <div className="summary-line">
          <strong>
            {attempts.filter((a) => a.correct).length} / {attempts.length}
          </strong>
          <span>
            answered correctly · {session.questionIds.length - attempts.length}{" "}
            unanswered · {time(attempts.reduce((n, a) => n + a.durationMs, 0))}{" "}
            answer time
          </span>
        </div>
        {missed.length > 0 && (
          <button className="primary" onClick={() => onRetry(missed)}>
            Practice these {missed.length} mistakes again →
          </button>
        )}
        <div className="result-list">
          {session.questionIds.map((id) => {
            const q = data.questions.find((q) => q.id === id)!;
            const a = attempts.find((a) => a.questionId === id);
            return (
              <details key={id}>
                <summary>
                  <span
                    className={
                      a?.correct ? "correct" : a ? "incorrect" : "muted"
                    }
                  >
                    {a ? (a.correct ? "Correct" : "Incorrect") : "Unanswered"}
                  </span>{" "}
                  · {q.skill || q.domain || sectionName(q.section)}
                </summary>
                <p className="question-text">{q.stem}</p>
                {a && (
                  <>
                    <p>Your answer: {displayAnswer(q, a.answer)}</p>
                    <p>Correct answer: {correctAnswer(q)}</p>
                    <p>
                      {q.rationale ||
                        "No rationale was included in this import."}
                    </p>
                  </>
                )}
              </details>
            );
          })}
        </div>
      </main>
    );
  return (
    <main className="practice-page">
      <div className="practice-toolbar">
        <button
          className="text-button"
          onClick={() =>
            void run(async () => {
              await timer.flush();
              onBack();
            })
          }
        >
          ← Library
        </button>
        <span>
          Question {session.index + 1}{" "}
          <span className="muted">of {session.questionIds.length}</span>
        </span>
        <div className="toolbar-right">
          <span className="timer" aria-label="Time on this question">
            {time((session.elapsed[question.id] || 0) + timer.pendingMs)}
          </span>
          <button
            onClick={() =>
              void run(async () => {
                await timer.flush();
                await mutate((d) => {
                  const s = d.sessions.find((s) => s.id === session.id)!;
                  s.paused = !s.paused;
                });
              })
            }
          >
            {session.paused ? "Resume timer" : "Pause timer"}
          </button>
          <button onClick={() => void finish()} disabled={pending}>
            Finish session
          </button>
        </div>
      </div>
      <div className="progress-track">
        <div
          style={{
            width: `${(100 * attempts.length) / session.questionIds.length}%`,
          }}
        />
      </div>
      <div className="practice-layout">
        <article className="question-card" key={question.id}>
          <div className="question-heading">
            <div>
              <p className="eyebrow">{sectionName(question.section)}</p>
              <span className="muted small">
                {question.domain || "Domain unspecified"} ·{" "}
                {question.difficulty || "Difficulty unspecified"}
              </span>
            </div>
            <button
              className={
                annotation.bookmarked ? "bookmark selected" : "bookmark"
              }
              aria-pressed={annotation.bookmarked}
              onClick={() =>
                void run(() =>
                  mutate((d) => {
                    d.annotations[question.id] = {
                      note: d.annotations[question.id]?.note || "",
                      bookmarked: !d.annotations[question.id]?.bookmarked,
                    };
                  }),
                )
              }
            >
              {annotation.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </button>
          </div>
          {question.testStatus === "active" && (
            <p className="notice">
              Active practice-test question · included by your filter selection.
            </p>
          )}
          {question.testStatus === "unknown" && (
            <p className="small muted">
              Practice-test status unknown; this question may appear in a
              practice test.
            </p>
          )}
          {question.passage && (
            <div className="passage">{question.passage}</div>
          )}
          {question.media?.map((m, i) => (
            <figure key={i}>
              <img src={m.dataUrl} alt={m.alt} />
              <figcaption>{m.alt}</figcaption>
            </figure>
          ))}
          <h1 className="question-text">{question.stem}</h1>
          <fieldset className="answers" disabled={!!attempt || pending}>
            <legend className="sr-only">Your answer</legend>
            {question.answer.type === "choice" ? (
              question.choices!.map((c) => (
                <label
                  key={c.id}
                  className={`answer-choice ${answer === c.id ? "chosen" : ""} ${attempt && question.answer.type === "choice" && question.answer.value === c.id ? "right-answer" : ""}`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={c.id}
                    checked={answer === c.id}
                    onChange={() => {
                      setDraft({ id: question.id, value: c.id });
                      void run(() =>
                        mutate((d) => {
                          d.sessions.find((s) => s.id === session.id)!.drafts[
                            question.id
                          ] = c.id;
                        }),
                      );
                    }}
                  />
                  <span className="choice-letter">{c.id}</span>
                  <span>{c.text}</span>
                </label>
              ))
            ) : (
              <label className="numeric-answer">
                Your answer
                <input
                  aria-label="Your numeric answer"
                  inputMode="text"
                  value={answer}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft({ id: question.id, value: v });
                    void mutate((d) => {
                      d.sessions.find((s) => s.id === session.id)!.drafts[
                        question.id
                      ] = v;
                    }).catch(() => {});
                  }}
                  placeholder="Enter a number or fraction"
                />
                <span className="small muted">
                  Decimals and fractions accepted (for example, 0.5 or 1/2).
                </span>
                {answer && numericValue(answer) === undefined && (
                  <span className="incorrect small">
                    Enter a valid number or fraction with a nonzero denominator.
                  </span>
                )}
              </label>
            )}
          </fieldset>
          {!attempt ? (
            <button
              className="primary submit"
              disabled={
                pending ||
                !answer ||
                (question.answer.type === "numeric" &&
                  numericValue(answer) === undefined)
              }
              onClick={() => void submit()}
            >
              Submit answer
            </button>
          ) : (
            <section
              className={`feedback ${attempt.correct ? "success" : "miss"}`}
              aria-live="polite"
            >
              <h2>
                {attempt.correct
                  ? "Correct. Nicely done."
                  : "Not quite. Let’s work through it."}
              </h2>
              <p>
                <strong>Correct answer:</strong> {correctAnswer(question)}
              </p>
              <h3>Explanation</h3>
              <p className="rationale">
                {question.rationale ||
                  "No rationale was included in this import."}
              </p>
              <span className="small muted">
                Your answer: {displayAnswer(question, attempt.answer)} ·{" "}
                {time(attempt.durationMs)}
              </span>
            </section>
          )}
          <div className="question-footer">
            <button
              disabled={session.index === 0 || pending}
              onClick={() => void navigate(session.index - 1)}
            >
              ← Previous
            </button>
            <span className="small muted">
              {attempts.length} of {session.questionIds.length} answered
            </span>
            {session.index < session.questionIds.length - 1 ? (
              <button
                className="primary"
                disabled={pending}
                onClick={() => void navigate(session.index + 1)}
              >
                Next question →
              </button>
            ) : (
              <button
                className="primary"
                disabled={pending}
                onClick={() => void finish()}
              >
                Review session →
              </button>
            )}
          </div>
        </article>
        <aside className="practice-aside">
          <section className="utility">
            <h3>Session map</h3>
            <div className="question-map">
              {session.questionIds.map((id, index) => {
                const a = attempts.find((a) => a.questionId === id);
                return (
                  <button
                    key={id}
                    aria-label={`Go to question ${index + 1}${a ? (a.correct ? ", correct" : ", incorrect") : ""}`}
                    aria-current={index === session.index ? "step" : undefined}
                    className={`${a ? (a.correct ? "map-correct" : "map-incorrect") : ""} ${index === session.index ? "current" : ""}`}
                    disabled={pending}
                    onClick={() => void navigate(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <p className="small muted">
              Filled squares are answered. You can skip and return.
            </p>
          </section>
          <section className="utility">
            <label htmlFor="question-note">
              <h3>My notes</h3>
            </label>
            <textarea
              id="question-note"
              value={note}
              placeholder="What will you remember next time?"
              onChange={(e) => {
                const note = e.target.value;
                setNoteDraft({ id: question.id, value: note });
                void mutate((d) => {
                  d.annotations[question.id] = {
                    bookmarked: d.annotations[question.id]?.bookmarked || false,
                    note,
                  };
                }).catch(() => {});
              }}
            />
            <p className="small muted">Saved locally as you type.</p>
          </section>
          {question.section === "math" && (
            <>
              <button
                className="calculator-toggle"
                aria-expanded={calculator}
                onClick={() => setCalculator(!calculator)}
              >
                {calculator ? "Hide calculator" : "Show calculator"}
              </button>
              {calculator && <Calculator />}
            </>
          )}
          <div className="source-details">
            <p>{question.skill || "Skill unspecified"}</p>
            <p>
              {question.source || "Source unspecified"}
              {question.sourceId ? ` · ${question.sourceId}` : ""}
            </p>
            <p>Practice-test status: {question.testStatus}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
function displayAnswer(q: Question, value: string) {
  return q.choices?.find((c) => c.id === value)
    ? `${value}. ${q.choices.find((c) => c.id === value)!.text}`
    : value;
}
function correctAnswer(q: Question) {
  return q.answer.type === "choice"
    ? displayAnswer(q, q.answer.value)
    : q.answer.accepted.join(" or ");
}
