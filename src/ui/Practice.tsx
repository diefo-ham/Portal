import { useEffect, useRef, useState } from "react";
import { useQuestionTimer } from "./useQuestionTimer";
import { submitAnswer, finishSession } from "../core/commands";
import type { Question, Session, StudyData } from "../core/model";
import { numericValue } from "../core/practice";
import { sectionName } from "./Filters";
import { Calculator } from "../calculator/Calculator";
import { DocumentPanels } from "./DocumentPanels";
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
  const [calculator, setCalculator] = useState(false);
  const [panel, setPanel] = useState<
    "overview" | "notes" | "details" | "tools" | null
  >(null);
  const [showTime, setShowTime] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const questionTop = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const openPanel = (value: typeof panel) => {
    trigger.current = document.activeElement as HTMLElement;
    setPanel(value);
  };
  useEffect(() => {
    if (panel) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [panel]);
  useEffect(() => {
    questionTop.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [question.id]);
  useEffect(() => {
    if (attempt) nextButton.current?.focus({ preventScroll: true });
  }, [attempt?.id]);
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
  const choose = (value: string) => {
    setDraft({ id: question.id, value });
    // Keep radio focus while its draft saves; transaction ordering still ensures
    // the draft is committed before a subsequent submission.
    void mutate((d) => {
      d.sessions.find((s) => s.id === session.id)!.drafts[question.id] = value;
    }).catch(() => {});
  };
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  const missed = attempts.filter((a) => !a.correct).map((a) => a.questionId);
  if (session.finishedAt)
    return (
      <main className="page narrow">
        <button className="text-button" onClick={onBack}>
          ← Back to practice
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
                {q.document ? (
                  <DocumentPanels question={q} kind="question" />
                ) : (
                  <p className="question-text">{q.stem}</p>
                )}
                {a && (
                  <>
                    <p>Your answer: {displayAnswer(q, a.answer)}</p>
                    <p>Correct answer: {correctAnswer(q)}</p>
                    {q.document ? (
                      <DocumentPanels question={q} kind="rationale" />
                    ) : (
                      <p>
                        {q.rationale ||
                          "No rationale was included in this import."}
                      </p>
                    )}
                  </>
                )}
              </details>
            );
          })}
        </div>
      </main>
    );
  return (
    <main
      onKeyDown={(e) => {
        if (
          panel ||
          pending ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          (e.target instanceof HTMLElement &&
            e.target.matches('input:not([type="radio"]),textarea,select'))
        )
          return;
        const choice = question.choices?.find(
          (c) => c.id.toLowerCase() === e.key.toLowerCase(),
        );
        if (!attempt && question.answer.type === "choice" && choice) {
          e.preventDefault();
          choose(choice.id);
        } else if (
          e.key === "Enter" &&
          !(e.target instanceof HTMLElement && e.target.closest("button")) &&
          answer &&
          !attempt &&
          (question.answer.type === "choice" ||
            numericValue(answer) !== undefined)
        ) {
          e.preventDefault();
          void submit();
        }
      }}
      className={`practice-page focused-practice ${calculator && question.section === "math" ? "with-calculator" : ""}`}
    >
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
          ← Exit
        </button>
        <button
          className="text-button"
          onClick={() => openPanel("overview")}
          aria-label="Open question overview"
        >
          Question {session.index + 1}{" "}
          <span className="muted">of {session.questionIds.length}</span>
        </button>
        <div className="toolbar-right">
          {session.paused && (
            <button onClick={() => openPanel("tools")}>Timing paused</button>
          )}
          {showTime && (
            <span className="timer" aria-label="Time on this question">
              {time((session.elapsed[question.id] || 0) + timer.pendingMs)}
            </span>
          )}
          {question.section === "math" && (
            <button
              aria-expanded={calculator}
              onClick={() => setCalculator(!calculator)}
            >
              Calculator
            </button>
          )}
          <button
            aria-label="Practice tools"
            onClick={() => openPanel("tools")}
          >
            •••
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
        <article
          className="question-card"
          key={question.id}
          ref={questionTop}
          tabIndex={-1}
          aria-label={`Question ${session.index + 1}`}
        >
          <div className="question-heading">
            <div>
              <p className="eyebrow">{sectionName(question.section)}</p>
              <span className="muted small">{question.domain || ""}</span>
            </div>
            <button
              className={
                annotation.bookmarked ? "bookmark selected" : "bookmark"
              }
              aria-pressed={annotation.bookmarked}
              aria-label={
                annotation.bookmarked ? "Remove bookmark" : "Bookmark question"
              }
              title={
                annotation.bookmarked ? "Remove bookmark" : "Bookmark question"
              }
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
              {annotation.bookmarked ? "★" : "☆"}
            </button>
            <button
              className="bookmark"
              aria-label={note ? "Edit note" : "Add note"}
              title={note ? "Edit note" : "Add note"}
              onClick={() => openPanel("notes")}
            >
              {note ? "✎ •" : "✎"}
            </button>
          </div>
          {question.passage && (
            <div className="passage">{question.passage}</div>
          )}
          {question.media?.map((m, i) => (
            <figure key={i}>
              <img src={m.dataUrl} alt={m.alt} />
              <figcaption>{m.alt}</figcaption>
            </figure>
          ))}
          {question.document ? (
            <>
              <h1 className="sr-only">Question {question.sourceId}</h1>
              {question.document.extractionWarnings?.map((warning, i) => (
                <p className="notice" key={i}>
                  {warning}
                </p>
              ))}
              <DocumentPanels question={question} kind="question" />
              <p className="small muted">
                {question.answer.type === "choice"
                  ? "Select an answer from the choices shown above."
                  : "Enter your answer below."}
              </p>
            </>
          ) : (
            <h1 className="question-text">{question.stem}</h1>
          )}
          <fieldset className="answers" disabled={!!attempt || pending}>
            <legend className="sr-only">Your answer</legend>
            {question.answer.type === "choice" ? (
              question.choices!.map((c) => (
                <label
                  key={c.id}
                  className={`answer-choice ${answer === c.id ? "chosen" : ""} ${attempt && !attempt.correct && answer === c.id ? "wrong-answer" : ""} ${attempt && question.answer.type === "choice" && question.answer.value === c.id ? "right-answer" : ""}`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={c.id}
                    checked={answer === c.id}
                    onChange={() => choose(c.id)}
                  />
                  <span className="choice-letter">{c.id}</span>
                  {!question.document && <span>{c.text}</span>}
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
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !pending &&
                      !attempt &&
                      numericValue(answer) !== undefined
                    ) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
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
              Check answer
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
              {question.document ? (
                <DocumentPanels question={question} kind="rationale" />
              ) : (
                <p className="rationale">
                  {question.rationale ||
                    "No rationale was included in this import."}
                </p>
              )}
              <span className="small muted">
                Your answer: {displayAnswer(question, attempt.answer)}
                {showTime ? ` · ${time(attempt.durationMs)}` : ""}
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
            {session.index < session.questionIds.length - 1 ? (
              <button
                ref={nextButton}
                className={attempt ? "primary" : "text-button"}
                disabled={pending}
                onClick={() => void navigate(session.index + 1)}
              >
                {attempt ? "Next question →" : "Skip for now →"}
              </button>
            ) : (
              <button
                ref={nextButton}
                className={attempt ? "primary" : "text-button"}
                disabled={pending}
                onClick={() => void finish()}
              >
                Review session →
              </button>
            )}
          </div>
        </article>
        {calculator && question.section === "math" && (
          <aside className="calculator-sheet" aria-label="Calculator panel">
            <button
              className="text-button"
              onClick={() => setCalculator(false)}
            >
              Close calculator ×
            </button>
            <Calculator />
          </aside>
        )}
      </div>
      <dialog
        ref={dialog}
        className="practice-dialog"
        onCancel={() => setPanel(null)}
        onClose={() => {
          setPanel(null);
          trigger.current?.focus();
        }}
      >
        <div className="dialog-heading">
          <h2>
            {panel === "overview"
              ? "Question overview"
              : panel === "notes"
                ? "My notes"
                : panel === "details"
                  ? "Question details"
                  : "Practice tools"}
          </h2>
          <button aria-label="Close panel" onClick={() => setPanel(null)}>
            ×
          </button>
        </div>
        {panel === "tools" && (
          <div className="tool-menu">
            <p className="small muted">
              Use A–D to choose an answer, then Enter to check it. After
              feedback, Enter advances. Timing pauses when you leave practice or
              switch tabs.
            </p>
            <button onClick={() => setPanel("overview")}>
              Question overview
            </button>
            <button onClick={() => setPanel("notes")}>
              {note ? "Edit note" : "Add note"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={showTime}
                onChange={(e) => setShowTime(e.target.checked)}
              />{" "}
              Show timer
            </label>
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
            <button onClick={() => setPanel("details")}>
              Question details
            </button>
            <button
              onClick={() => {
                setPanel(null);
                void finish();
              }}
              disabled={pending}
            >
              Finish session
            </button>
          </div>
        )}
        {panel === "overview" && (
          <>
            <section className="utility">
              <h3>Session map</h3>
              <div className="question-map">
                {session.questionIds.map((id, index) => {
                  const a = attempts.find((a) => a.questionId === id);
                  return (
                    <button
                      key={id}
                      aria-label={`Go to question ${index + 1}${a ? (a.correct ? ", correct" : ", incorrect") : ""}`}
                      aria-current={
                        index === session.index ? "step" : undefined
                      }
                      className={`${a ? (a.correct ? "map-correct" : "map-incorrect") : ""} ${index === session.index ? "current" : ""}`}
                      disabled={pending}
                      onClick={() => {
                        setPanel(null);
                        void navigate(index);
                      }}
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
            <button
              onClick={() => {
                setPanel(null);
                void finish();
              }}
              disabled={pending}
            >
              Finish session
            </button>
          </>
        )}
        {panel === "notes" && (
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
        )}
        {panel === "details" && (
          <div className="source-details">
            <p>Difficulty: {question.difficulty || "Unspecified"}</p>
            <p>{question.skill || "Skill unspecified"}</p>
            <p>
              {question.source || "Source unspecified"}
              {question.sourceId ? ` · ${question.sourceId}` : ""}
            </p>
            <p>Practice-test status: {question.testStatus}</p>
            {question.document && (
              <details>
                <summary>PDF source details</summary>
                {question.document.provenance.map((p) => (
                  <p key={p.filename}>
                    {p.filename} · pages {p.pages.join(", ")}
                  </p>
                ))}
                <p>
                  Original layout is shown above. Search text was extracted
                  automatically and may omit math notation.
                </p>
              </details>
            )}
          </div>
        )}
      </dialog>
    </main>
  );
}
function displayAnswer(q: Question, value: string) {
  if (q.document && q.answer.type === "choice") return value;
  return q.choices?.find((c) => c.id === value)
    ? `${value}. ${q.choices.find((c) => c.id === value)!.text}`
    : value;
}
function correctAnswer(q: Question) {
  return q.answer.type === "choice"
    ? displayAnswer(q, q.answer.value)
    : q.answer.accepted.join(" or ");
}
