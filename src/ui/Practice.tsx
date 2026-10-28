import { useEffect, useRef, useState } from "react";
import { ShortcutHelp } from "./Help";
import { useQuestionTimer } from "./useQuestionTimer";
import { submitAnswer, finishSession } from "../core/commands";
import type { Session, StudyData } from "../core/model";
import { numericValue } from "../core/practice";
import { sectionName } from "./Filters";
import "../calculator/layout.css";
import { useCalculatorState } from "../calculator/useCalculatorState";
import { CalculatorPanel } from "../calculator/CalculatorPanel";
import { DocumentPanels } from "./DocumentPanels";
import { SessionResults, displayAnswer, correctAnswer } from "./SessionResults";
type Mutate = (fn: (d: StudyData) => void) => Promise<StudyData>;
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export function Practice({
  data,
  session,
  mutate,
  showCorrectExplanations,
  onBack,
  onRetry,
}: {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  showCorrectExplanations: boolean;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
}) {
  const question = data.questions.find(
    (q) => q.id === session.questionIds[session.index],
  )!;
  const attempt = data.attempts.find(
    (a) => a.questionId === question.id && a.sessionId === session.id,
  );
  const [pending, setPending] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [calculatorShortcutInverted, setCalculatorShortcutInverted] =
    useState(false);
  const calculatorShortcutHeld = useRef(false);
  const calculatorShortcutInvertedRef = useRef(false);
  const calculatorFocusBeforeShortcut = useRef<HTMLElement | null>(null);
  const calculatorWork = useCalculatorState(
    session.id,
    session.calculator,
    mutate,
  );
  const [panel, setPanel] = useState<
    "overview" | "details" | "tools" | "leave" | null
  >(null);
  const [panelParent, setPanelParent] = useState<"tools" | null>(null);
  const showTime = session.timerVisible ?? false;
  const dialog = useRef<HTMLDialogElement>(null);
  const questionTop = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const calculatorAvailable = session.finishedAt
    ? session.questionIds.some((id) =>
        data.questions.some(
          (candidate) => candidate.id === id && candidate.section === "math",
        ),
      )
    : question.section === "math";
  const calculatorRendered =
    calculatorAvailable && (calculator || calculatorShortcutInverted);
  const calculatorTemporarilyHidden = calculator && calculatorShortcutInverted;
  const calculatorVisible = calculatorRendered && !calculatorTemporarilyHidden;
  const openPanel = (value: Exclude<typeof panel, null>) => {
    if (!panel) trigger.current = document.activeElement as HTMLElement;
    setPanelParent(null);
    setPanel(value);
  };
  const openToolDetail = (value: "overview" | "details") => {
    setPanelParent("tools");
    setPanel(value);
  };
  useEffect(() => {
    if (panel) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) dialog.current.close();
  }, [panel]);
  useEffect(() => {
    questionTop.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [question.id]);
  useEffect(() => {
    if (attempt) nextButton.current?.focus({ preventScroll: true });
  }, [attempt?.id]);
  useEffect(() => {
    const finishInversion = (restoreFocus: boolean) => {
      if (
        !calculatorShortcutHeld.current &&
        !calculatorShortcutInvertedRef.current
      )
        return;
      calculatorShortcutHeld.current = false;
      calculatorShortcutInvertedRef.current = false;
      setCalculatorShortcutInverted(false);
      const previous = calculatorFocusBeforeShortcut.current;
      calculatorFocusBeforeShortcut.current = null;
      if (restoreFocus && previous?.isConnected)
        requestAnimationFrame(() => previous.focus({ preventScroll: true }));
    };
    if (!calculatorAvailable || panel || pending) {
      finishInversion(false);
      return;
    }
    const shortcutIsInappropriate = () =>
      !!document.querySelector('dialog[open],[aria-modal="true"]');
    const keydown = (event: KeyboardEvent) => {
      if (
        calculatorShortcutHeld.current &&
        (event.key === "Shift" ||
          event.key === "Control" ||
          event.key === "Alt" ||
          event.key === "Meta")
      ) {
        finishInversion(true);
        return;
      }
      if (
        event.code !== "Backslash" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        shortcutIsInappropriate()
      )
        return;
      // Repeats are prevented as well so a held shortcut cannot leak text.
      event.preventDefault();
      if (event.repeat || calculatorShortcutHeld.current) return;
      calculatorShortcutHeld.current = true;
      calculatorShortcutInvertedRef.current = true;
      calculatorFocusBeforeShortcut.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setCalculatorShortcutInverted(true);
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Backslash") finishInversion(true);
    };
    const blur = () => finishInversion(false);
    const visibility = () => {
      if (document.hidden) finishInversion(false);
    };
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [calculatorAvailable, panel, pending]);
  const [draft, setDraft] = useState<{ id: string; value: string }>();
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
      await calculatorWork.flush();
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
  const toggleBookmark = () =>
    run(() =>
      mutate((d) => {
        d.annotations[question.id] = {
          note: d.annotations[question.id]?.note || "",
          bookmarked: !d.annotations[question.id]?.bookmarked,
        };
      }),
    );
  const closeCalculator = () => {
    void calculatorWork.flush().catch(() => {});
    calculatorShortcutHeld.current = false;
    calculatorShortcutInvertedRef.current = false;
    calculatorFocusBeforeShortcut.current = null;
    setCalculatorShortcutInverted(false);
    setCalculator(false);
    requestAnimationFrame(() =>
      (
        questionTop.current ??
        document.querySelector<HTMLElement>(".result-calculator")
      )?.focus({ preventScroll: true }),
    );
  };
  const openCalculator = () => {
    calculatorShortcutHeld.current = false;
    calculatorShortcutInvertedRef.current = false;
    calculatorFocusBeforeShortcut.current = null;
    setCalculatorShortcutInverted(false);
    setCalculator(true);
  };
  const leave = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      setPanel(null);
      onBack();
    });
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  if (session.finishedAt)
    return (
      <div className="completed-calculator-context">
        <SessionResults
          data={data}
          session={session}
          onBack={onBack}
          onRetry={onRetry}
          onCalculator={calculatorAvailable ? openCalculator : undefined}
        />
        {calculatorRendered && (
          <CalculatorPanel
            state={calculatorWork.state}
            onChange={calculatorWork.change}
            onClose={closeCalculator}
            temporarilyHidden={calculatorTemporarilyHidden}
            autoFocus={calculator}
            shortcutHint={
              calculator ? "Hold \\ to temporarily hide" : "Release \\ to close"
            }
          />
        )}
      </div>
    );
  return (
    <main
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          panel ||
          pending ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.repeat ||
          (e.target instanceof HTMLElement &&
            e.target.closest(
              'textarea,select,input:not([type="radio"]),[contenteditable="true"],[role="textbox"]',
            ))
        )
          return;
        if (e.key === "Escape") {
          const disclosure =
            e.target instanceof Element && e.target.closest("details[open]");
          if (disclosure) {
            disclosure.removeAttribute("open");
            e.preventDefault();
            return;
          }
          e.preventDefault();
          openPanel("leave");
          return;
        }
        const focusedControl =
          e.target instanceof HTMLElement &&
          e.target.closest(
            'button,input,a,summary,[role="button"],[role="combobox"],[role="listbox"],[role="slider"],[role="spinbutton"],[role="switch"],[role="checkbox"],[role="menuitem"]',
          );
        if (e.key.toLowerCase() === "e" && !focusedControl) {
          e.preventDefault();
          void toggleBookmark();
          return;
        }
        const choice = /^[1-4]$/.test(e.key)
          ? question.choices?.[Number(e.key) - 1]
          : question.choices?.find(
              (c) => c.id.toLowerCase() === e.key.toLowerCase(),
            );
        if (
          !attempt &&
          question.answer.type === "choice" &&
          choice &&
          (!focusedControl ||
            (e.target instanceof HTMLInputElement && e.target.type === "radio"))
        ) {
          e.preventDefault();
          choose(choice.id);
        } else if (
          (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
          !(
            e.target instanceof HTMLElement &&
            e.target.closest(
              'input,[role="slider"],[role="spinbutton"],[role="listbox"],[role="combobox"]',
            )
          )
        ) {
          const index = session.index + (e.key === "ArrowLeft" ? -1 : 1);
          if (index >= 0 && index < session.questionIds.length) {
            e.preventDefault();
            void navigate(index);
          }
        } else if (!(
          e.target instanceof HTMLElement &&
          e.target.closest(
            'button,input,a,[role="button"],[role="slider"],[role="spinbutton"]',
          )
        )) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (attempt) {
              if (session.index < session.questionIds.length - 1)
                void navigate(session.index + 1);
              else void finish();
            } else if (
              answer &&
              (question.answer.type === "choice" ||
                numericValue(answer) !== undefined)
            )
              void submit();
          }
        } else if (
          e.key === "Enter" &&
          e.target instanceof HTMLInputElement &&
          e.target.type === "radio" &&
          answer &&
          !attempt
        ) {
          e.preventDefault();
          void submit();
        }
      }}
      className="practice-page focused-practice"
    >
      <div className="practice-toolbar">
        <button
          className="text-button"
          onClick={() =>
            void run(async () => {
              await timer.flush();
              await calculatorWork.flush();
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
              aria-expanded={calculatorVisible}
              title={
                calculator
                  ? "Close Calculator · Hold \\ to temporarily hide"
                  : "Open Calculator · Hold \\ to peek at Calculator"
              }
              onClick={() => {
                if (calculator) closeCalculator();
                else openCalculator();
              }}
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
                annotation.bookmarked
                  ? "Remove bookmark (E)"
                  : "Bookmark question (E)"
              }
              onClick={(e) => {
                // Pointer activation returns to reading; keyboard activation keeps
                // button focus and its pressed state accessible.
                if (e.detail > 0)
                  questionTop.current?.focus({ preventScroll: true });
                void toggleBookmark();
              }}
            >
              {annotation.bookmarked ? "★" : "☆"}
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
              {attempt.correct && !showCorrectExplanations ? (
                <details className="correct-explanation">
                  <summary>View explanation</summary>
                  {question.document ? (
                    <DocumentPanels question={question} kind="rationale" />
                  ) : (
                    <p className="rationale">
                      {question.rationale ||
                        "No rationale was included in this import."}
                    </p>
                  )}
                </details>
              ) : (
                <>
                  <h3>Explanation</h3>
                  {question.document ? (
                    <DocumentPanels question={question} kind="rationale" />
                  ) : (
                    <p className="rationale">
                      {question.rationale ||
                        "No rationale was included in this import."}
                    </p>
                  )}
                </>
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
        {calculatorRendered && question.section === "math" && (
          <CalculatorPanel
            state={calculatorWork.state}
            onChange={calculatorWork.change}
            onClose={closeCalculator}
            temporarilyHidden={calculatorTemporarilyHidden}
            autoFocus={calculator}
            shortcutHint={
              calculator ? "Hold \\ to temporarily hide" : "Release \\ to close"
            }
          />
        )}
      </div>
      <dialog
        ref={dialog}
        className="practice-dialog"
        onCancel={(event) => {
          if (panel === "leave") {
            event.preventDefault();
            if (!pending) void leave();
          } else setPanel(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.repeat) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPanel(null);
        }}
        onClose={() => {
          setPanel(null);
          setPanelParent(null);
          trigger.current?.focus();
        }}
      >
        <div className="dialog-heading">
          {panelParent === "tools" && panel !== "tools" && (
            <button
              className="dialog-back"
              aria-label="Back to Practice tools"
              onClick={() => {
                setPanelParent(null);
                setPanel("tools");
              }}
            >
              ← <span>Back</span>
            </button>
          )}
          <h2>
            {panel === "overview"
              ? "Question overview"
              : panel === "details"
                ? "Question details"
                : panel === "leave"
                  ? "Leave this session?"
                  : "Practice tools"}
          </h2>
          <button aria-label="Close panel" onClick={() => setPanel(null)}>
            ×
          </button>
        </div>
        {panel === "leave" && (
          <div className="tool-menu">
            <p>
              Your work is saved. You can resume this session from Practice.
            </p>
            <button onClick={() => setPanel(null)}>Cancel</button>
            <button
              className="primary"
              disabled={pending}
              onClick={() => void leave()}
            >
              Leave session
            </button>
          </div>
        )}
        {panel === "tools" && (
          <div className="tool-menu">
            <details>
              <summary>Keyboard shortcuts & help</summary>
              <ShortcutHelp />
            </details>
            <button onClick={() => openToolDetail("overview")}>
              Question overview
            </button>
            <label>
              <input
                type="checkbox"
                checked={showTime}
                onChange={(e) => {
                  const visible = e.target.checked;
                  void mutate((d) => {
                    const current = d.sessions.find((s) => s.id === session.id);
                    if (current) current.timerVisible = visible;
                  }).catch(() => {});
                }}
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
            <button onClick={() => openToolDetail("details")}>
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
