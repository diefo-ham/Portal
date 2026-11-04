import { useEffect, useRef, useState } from "react";
import { ShortcutHelp } from "./Help";
import { useT } from "./i18n";
import { useQuestionTimer } from "./useQuestionTimer";
import { submitAnswer, finishSession } from "../core/commands";
import type { Session, StudyData } from "../core/model";
import {
  saveTestDraft,
  deadlinePassed,
  toggleReviewMark,
} from "../core/practiceTest";
import { numericValue } from "../core/practice";
import { sectionName } from "./Filters";
import "../calculator/layout.css";
import { useCalculatorState } from "../calculator/useCalculatorState";
import { CalculatorPanel } from "../calculator/CalculatorPanel";
import { DocumentPanels } from "./DocumentPanels";
import { PracticeTestResults } from "./PracticeTestResults";
import { SessionResults, displayAnswer, correctAnswer } from "./SessionResults";
type Mutate = (fn: (d: StudyData) => void) => Promise<StudyData>;
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export function Practice({
  data,
  session: storedSession,
  mutate,
  showCorrectExplanations,
  onBack,
  onRetry,
  testClock,
  onFinishModule,
  onPauseTest,
  onResumeTest,
  onCancelTest,
}: {
  testClock?: { label: string; ms: number; warning?: boolean };
  onFinishModule?: () => Promise<unknown>;
  onPauseTest?: () => Promise<unknown>;
  onResumeTest?: () => Promise<unknown>;
  onCancelTest?: () => Promise<unknown>;
  data: StudyData;
  session: Session;
  mutate: Mutate;
  showCorrectExplanations: boolean;
  onBack: () => void | Promise<unknown>;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
}) {
  const t = useT();
  const test = storedSession.practiceTest;
  const isTest = !!test && !storedSession.finishedAt;
  const module = isTest ? test.modules[test.currentModule] : undefined;
  const session = module
    ? {
        ...storedSession,
        questionIds: module.questionIds,
        index: module.questionIds.indexOf(
          storedSession.questionIds[storedSession.index],
        ),
      }
    : storedSession;
  const question = data.questions.find(
    (q) => q.id === session.questionIds[session.index],
  )!;
  const attempt = data.attempts.find(
    (a) => a.questionId === question.id && a.sessionId === session.id,
  );
  const [pending, setPending] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [calculatorAutoFocus, setCalculatorAutoFocus] = useState(true);
  const calculatorWork = useCalculatorState(
    session.id,
    session.calculator,
    mutate,
  );
  const [panel, setPanel] = useState<
    "overview" | "details" | "tools" | "leave" | "cancel-test" | null
  >(null);
  const [panelParent, setPanelParent] = useState<"tools" | null>(null);
  const showTime = isTest || (session.timerVisible ?? false);
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
  const calculatorVisible = calculatorAvailable && calculator;
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
    if (!calculatorAvailable || panel || pending || session.paused) return;
    const shortcutIsInappropriate = () =>
      !!document.querySelector('dialog[open],[aria-modal="true"]');
    const keydown = (event: KeyboardEvent) => {
      if (
        event.code !== "Backslash" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        shortcutIsInappropriate()
      )
        return;
      event.preventDefault();
      if (event.repeat) return;
      const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (calculator) void calculatorWork.flush().catch(() => {});
      setCalculatorAutoFocus(false);
      setCalculator((visible) => !visible);
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        else questionTop.current?.focus({ preventScroll: true });
      });
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("keydown", keydown, true);
    };
  }, [
    calculator,
    calculatorAvailable,
    calculatorWork,
    panel,
    pending,
    session.paused,
  ]);
  useEffect(() => {
    if (session.paused) setCalculator(false);
  }, [session.paused]);
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
      if (session.paused) return;
      await timer.flush();
      await mutate((d) => {
        const current = d.sessions.find((s) => s.id === session.id)!;
        if (
          isTest &&
          (current.paused ||
            deadlinePassed(current) ||
            current.practiceTest?.currentModule !== test?.currentModule)
        )
          return;
        current.index = current.questionIds.indexOf(session.questionIds[index]);
      });
    });
  const submit = () =>
    isTest
      ? session.index < session.questionIds.length - 1
        ? navigate(session.index + 1)
        : finish()
      : run(async () => {
          await timer.flush();
          await mutate((d) => submitAnswer(d, session.id, question.id, answer));
        });
  const finish = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      if (onFinishModule) await onFinishModule();
      else await mutate((d) => finishSession(d, session.id));
    });
  const choose = (value: string) => {
    if (session.paused) return;
    setDraft({ id: question.id, value });
    // Keep radio focus while its draft saves; transaction ordering still ensures
    // the draft is committed before a subsequent submission.
    void mutate((d) => {
      const current = d.sessions.find((s) => s.id === session.id)!;
      if (isTest) saveTestDraft(d, session.id, question.id, value);
      else current.drafts[question.id] = value;
    }).catch(() => {});
  };
  const toggleChoice = (value: string) => choose(answer === value ? "" : value);
  const toggleBookmark = () =>
    run(() =>
      mutate((d) => {
        if (isTest) {
          toggleReviewMark(d, session.id, question.id);
          return;
        }
        d.annotations[question.id] = {
          note: d.annotations[question.id]?.note || "",
          bookmarked: !d.annotations[question.id]?.bookmarked,
        };
      }),
    );
  const markedForReview =
    isTest && !!test?.markedForReview?.includes(question.id);
  const pauseTest = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      setCalculator(false);
      await onPauseTest?.();
    });
  const closeCalculator = () => {
    void calculatorWork.flush().catch(() => {});
    setCalculator(false);
    requestAnimationFrame(() =>
      (
        questionTop.current ??
        document.querySelector<HTMLElement>(".result-calculator")
      )?.focus({ preventScroll: true }),
    );
  };
  const openCalculator = () => {
    setCalculatorAutoFocus(true);
    setCalculator(true);
  };
  const leave = () =>
    run(async () => {
      await timer.flush();
      await calculatorWork.flush();
      setPanel(null);
      await onBack();
    });
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  if (session.finishedAt)
    return (
      <div className="completed-calculator-context">
        {storedSession.practiceTest ? (
          <PracticeTestResults
            data={data}
            session={storedSession}
            mutate={mutate}
            onBack={onBack}
            onRetry={onRetry}
          />
        ) : (
          <SessionResults
            data={data}
            session={session}
            mutate={mutate}
            onBack={onBack}
            onRetry={onRetry}
            onCalculator={calculatorAvailable ? openCalculator : undefined}
          />
        )}
        {calculatorVisible && (
          <CalculatorPanel
            state={calculatorWork.state}
            onChange={calculatorWork.change}
            onClose={closeCalculator}
            autoFocus={calculatorAutoFocus}
          />
        )}
      </div>
    );
  return (
    <main
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          session.paused ||
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
          toggleChoice(choice.id);
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
              await onBack();
            })
          }
        >
          {t("← Exit")}
        </button>
        <button
          className="text-button"
          onClick={() => {
            if (isTest) void finish();
            else openPanel("overview");
          }}
          aria-label={t("Open question overview")}
        >
          {t("Question {n}", { n: session.index + 1 })}{" "}
          <span className="muted">
            {t("of {total}", { total: session.questionIds.length })}
          </span>
        </button>
        <div className="toolbar-right">
          {showTime && (
            <span
              className={`timer ${testClock ? "test-timer" : ""} ${testClock?.warning ? "timer-warning" : ""}`}
              aria-label={testClock?.label || t("Time on this question")}
            >
              {time(
                testClock
                  ? testClock.ms
                  : (session.elapsed[question.id] || 0) + timer.pendingMs,
              )}
            </span>
          )}
          {isTest && (
            <button
              className="pause-test"
              disabled={pending || session.paused}
              onClick={() => void pauseTest()}
            >
              Pause
            </button>
          )}
          {question.section === "math" && (
            <button
              disabled={session.paused}
              aria-expanded={calculatorVisible}
              title={`${calculator ? "Close" : "Open"} Calculator · \\ toggles`}
              onClick={() => {
                if (calculator) closeCalculator();
                else openCalculator();
              }}
            >
              Calculator
            </button>
          )}
          <button
            aria-label={t("Practice tools")}
            onClick={() => openPanel("tools")}
          >
            •••
          </button>
        </div>
      </div>
      {module && (
        <p className="test-module-label small muted">
          {module.section === "math" ? "Math" : "Reading and Writing"} · Module{" "}
          {module.mix === "first" ? "1" : "2"}
        </p>
      )}
      <div className="progress-track">
        <div
          style={{
            width: `${(100 * (isTest ? session.questionIds.filter((id) => session.drafts[id]).length : attempts.length)) / session.questionIds.length}%`,
          }}
        />
      </div>
      <div className="practice-layout">
        <article
          className="question-card"
          key={question.id}
          ref={questionTop}
          tabIndex={-1}
          aria-label={t("Question {n}", { n: session.index + 1 })}
        >
          <div className="question-heading">
            <div>
              <p className="eyebrow">{sectionName(question.section)}</p>
              <span className="muted small">{question.domain || ""}</span>
            </div>
            <button
              className={`${isTest ? "review-mark" : "bookmark"} ${(isTest ? markedForReview : annotation.bookmarked) ? "selected" : ""}`}
              aria-pressed={isTest ? markedForReview : annotation.bookmarked}
              aria-label={
                isTest
                  ? markedForReview
                    ? "Unmark for review"
                    : "Mark for review"
                  : annotation.bookmarked
                    ? t("Remove bookmark")
                    : t("Bookmark question")
              }
              title={
                isTest
                  ? `${markedForReview ? "Unmark" : "Mark"} for review (E)`
                  : annotation.bookmarked
                    ? t("Remove bookmark (E)")
                    : t("Bookmark question (E)")
              }
              onClick={(e) => {
                // Pointer activation returns to reading; keyboard activation keeps
                // button focus and its pressed state accessible.
                if (e.detail > 0)
                  questionTop.current?.focus({ preventScroll: true });
                void toggleBookmark();
              }}
            >
              <span aria-hidden="true">
                {isTest
                  ? markedForReview
                    ? "⚑"
                    : "⚐"
                  : annotation.bookmarked
                    ? "★"
                    : "☆"}
              </span>
              {isTest && <span>Mark for review</span>}
            </button>
          </div>
          {question.passage && !question.document && (
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
              <h1 className="sr-only">
                {t("Question {id}", { id: question.sourceId ?? "" })}
              </h1>
              {question.document.extractionWarnings?.map((warning, i) => (
                <p className="notice" key={i}>
                  {warning}
                </p>
              ))}
              <DocumentPanels question={question} kind="question" />
              <p className="small muted">
                {question.answer.type === "choice"
                  ? t("Select an answer from the choices shown above.")
                  : t("Enter your answer below.")}
              </p>
            </>
          ) : (
            <h1 className="question-text">{question.stem}</h1>
          )}
          <fieldset
            className="answers"
            disabled={!!attempt || pending || session.paused}
          >
            <legend className="sr-only">{t("Your answer")}</legend>
            {question.answer.type === "choice" ? (
              question.choices!.map((c) => (
                <label
                  className={`answer-choice ${answer === c.id ? "chosen" : ""} ${attempt && !attempt.correct && answer === c.id ? "wrong-answer" : ""} ${attempt && question.answer.type === "choice" && question.answer.value === c.id ? "right-answer" : ""}`}
                  key={c.id}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={c.id}
                    checked={answer === c.id}
                    onClick={(event) => {
                      if (answer === c.id) {
                        event.preventDefault();
                        choose("");
                      }
                    }}
                    onChange={() => choose(c.id)}
                  />
                  <span className="choice-letter">{c.id}</span>
                  {!question.document && <span>{c.text}</span>}
                </label>
              ))
            ) : (
              <label className="numeric-answer">
                {t("Your answer")}
                <input
                  aria-label={t("Your numeric answer")}
                  inputMode="text"
                  value={answer}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft({ id: question.id, value: v });
                    void mutate((d) => {
                      if (isTest) saveTestDraft(d, session.id, question.id, v);
                      else
                        d.sessions.find((s) => s.id === session.id)!.drafts[
                          question.id
                        ] = v;
                    }).catch(() => {});
                  }}
                  placeholder={t("Enter a number or fraction")}
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
                  {question.assessment === "PAA"
                    ? t(
                        "Positive numbers only, up to 4 characters (for example, 7.5 or 15/2). Mixed numbers are not accepted.",
                      )
                    : t(
                        "Decimals and fractions accepted (for example, 0.5 or 1/2).",
                      )}
                </span>
                {answer && numericValue(answer) === undefined && (
                  <span className="incorrect small">
                    {t(
                      "Enter a valid number or fraction with a nonzero denominator.",
                    )}
                  </span>
                )}
              </label>
            )}
          </fieldset>
          {isTest ? null : !attempt ? (
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
              {t("Check answer")}
            </button>
          ) : (
            <section
              className={`feedback ${attempt.correct ? "success" : "miss"}`}
              aria-live="polite"
            >
              <h2>
                {attempt.correct
                  ? t("Correct. Nicely done.")
                  : t("Not quite. Let’s work through it.")}
              </h2>
              <p>
                <strong>{t("Correct answer:")}</strong>{" "}
                {correctAnswer(question, t)}
              </p>
              {attempt.correct && !showCorrectExplanations ? (
                <details className="correct-explanation">
                  <summary>{t("View explanation")}</summary>
                  {question.document ? (
                    <DocumentPanels question={question} kind="rationale" />
                  ) : (
                    <p className="rationale">
                      {question.rationale ||
                        t("No rationale was included in this import.")}
                    </p>
                  )}
                </details>
              ) : (
                <>
                  <h3>{t("Explanation")}</h3>
                  {question.document ? (
                    <DocumentPanels question={question} kind="rationale" />
                  ) : (
                    <p className="rationale">
                      {question.rationale ||
                        t("No rationale was included in this import.")}
                    </p>
                  )}
                </>
              )}
              <span className="small muted">
                {t("Your answer: {answer}", {
                  answer: displayAnswer(question, attempt.answer),
                })}
                {showTime ? ` · ${time(attempt.durationMs)}` : ""}
              </span>
            </section>
          )}
          <div className="question-footer">
            <button
              disabled={session.index === 0 || pending || session.paused}
              onClick={() => void navigate(session.index - 1)}
            >
              {t("← Previous")}
            </button>
            {session.index < session.questionIds.length - 1 ? (
              <button
                ref={nextButton}
                className={attempt ? "primary" : "text-button"}
                disabled={pending || session.paused}
                onClick={() => void navigate(session.index + 1)}
              >
                {isTest
                  ? "Next question →"
                  : attempt
                    ? t("Next question →")
                    : t("Skip for now →")}
              </button>
            ) : (
              <button
                ref={nextButton}
                className={attempt ? "primary" : "text-button"}
                disabled={pending || session.paused}
                onClick={() => void finish()}
              >
                {isTest ? "Finish module →" : t("Review session →")}
              </button>
            )}
          </div>
        </article>
        {calculatorVisible &&
          question.section === "math" &&
          !session.paused && (
            <CalculatorPanel
              state={calculatorWork.state}
              onChange={calculatorWork.change}
              onClose={closeCalculator}
              autoFocus={calculatorAutoFocus}
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
              aria-label={t("Back to Practice tools")}
              onClick={() => {
                setPanelParent(null);
                setPanel("tools");
              }}
            >
              ← <span>{t("Back")}</span>
            </button>
          )}
          <h2>
            {panel === "overview"
              ? t("Question overview")
              : panel === "details"
                ? t("Question details")
                : panel === "leave"
                  ? t("Leave this session?")
                  : panel === "cancel-test"
                    ? "Cancel Practice Test?"
                    : t("Practice tools")}
          </h2>
          <button aria-label={t("Close panel")} onClick={() => setPanel(null)}>
            ×
          </button>
        </div>
        {panel === "leave" && (
          <div className="tool-menu">
            <p>
              {isTest
                ? "Your work is saved. Leaving pauses the module. Resume explicitly when you return."
                : t(
                    "Your work is saved. You can resume this session from Practice.",
                  )}
            </p>
            <button onClick={() => setPanel(null)}>{t("Cancel")}</button>
            <button
              className="primary"
              disabled={pending}
              onClick={() => void leave()}
            >
              {t("Leave session")}
            </button>
          </div>
        )}
        {panel === "tools" && (
          <div className="tool-menu">
            <details>
              <summary>{t("Keyboard shortcuts & help")}</summary>
              <ShortcutHelp />
            </details>
            <button
              onClick={() => {
                if (isTest) {
                  setPanel(null);
                  void finish();
                } else openToolDetail("overview");
              }}
            >
              {t("Question overview")}
            </button>
            {!isTest && (
              <label>
                <input
                  type="checkbox"
                  checked={showTime}
                  onChange={(e) => {
                    const visible = e.target.checked;
                    void mutate((d) => {
                      const current = d.sessions.find(
                        (s) => s.id === session.id,
                      );
                      if (current) current.timerVisible = visible;
                    }).catch(() => {});
                  }}
                />{" "}
                {t("Show timer")}
              </label>
            )}
            {!isTest && (
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
                {session.paused ? t("Resume timer") : t("Pause timer")}
              </button>
            )}
            <button onClick={() => openToolDetail("details")}>
              {t("Question details")}
            </button>
            {isTest && onCancelTest && (
              <button
                className="danger"
                onClick={() => {
                  setPanelParent("tools");
                  setPanel("cancel-test");
                }}
              >
                Cancel Practice Test
              </button>
            )}
            {!isTest && (
              <button
                onClick={() => {
                  setPanel(null);
                  void finish();
                }}
                disabled={pending}
              >
                {t("Finish session")}
              </button>
            )}
          </div>
        )}
        {panel === "cancel-test" && onCancelTest && (
          <div className="tool-menu">
            <p>
              The resumable attempt will be removed without results or an SAT
              estimate. Questions already shown will remain used for Practice
              Tests.
            </p>
            <button onClick={() => setPanel("tools")}>Keep test</button>
            <button
              className="danger"
              disabled={pending}
              onClick={() => void run(onCancelTest)}
            >
              Cancel Practice Test
            </button>
          </div>
        )}
        {panel === "overview" && (
          <>
            <section className="utility">
              <h3>{t("Session map")}</h3>
              <div className="question-map">
                {session.questionIds.map((id, index) => {
                  const a = attempts.find((a) => a.questionId === id);
                  const saved = isTest && !!session.drafts[id];
                  return (
                    <button
                      key={id}
                      aria-label={t("Go to question {n}", { n: index + 1 }) + (saved ? t(", answered") : a ? (a.correct ? t(", correct") : t(", incorrect")) : "")}
                      aria-current={
                        index === session.index ? "step" : undefined
                      }
                      className={`${saved ? "map-answered" : a ? (a.correct ? "map-correct" : "map-incorrect") : ""} ${index === session.index ? "current" : ""}`}
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
                {t("Filled squares are answered. You can skip and return.")}
              </p>
            </section>
            <button
              onClick={() => {
                setPanel(null);
                void finish();
              }}
              disabled={pending}
            >
              {isTest ? "Finish module" : t("Finish session")}
            </button>
          </>
        )}
        {panel === "details" && (
          <div className="source-details">
            <p>
              {t("Difficulty: {difficulty}", {
                difficulty: question.difficulty
                  ? t(question.difficulty)
                  : t("Unspecified"),
              })}
            </p>
            <p>
              {question.skill || t("Skill unspecified")}
              {question.skillDetail ? ` · ${question.skillDetail}` : ""}
            </p>
            <p>
              {question.source || t("Source unspecified")}
              {question.sourceId ? ` · ${question.sourceId}` : ""}
            </p>
            {question.assessment !== "PAA" && (
              <p>Practice-test status: {question.testStatus}</p>
            )}
            {question.document && (
              <details>
                <summary>{t("PDF source details")}</summary>
                {question.document.provenance.map((p) => (
                  <p key={p.filename}>
                    {t("{file} · pages {pages}", {
                      file: p.filename,
                      pages: p.pages.join(", "),
                    })}
                  </p>
                ))}
                <p>
                  {t(
                    "Original layout is shown above. Search text was extracted automatically and may omit math notation.",
                  )}
                </p>
              </details>
            )}
          </div>
        )}
      </dialog>
      {isTest && session.paused && (
        <div
          className="test-paused-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paused-heading"
        >
          <section className="test-paused-card">
            <p className="eyebrow">PRACTICE TEST PAUSED</p>
            <h1 id="paused-heading">Your time is frozen.</h1>
            <p className="muted">
              Answers, navigation, and the Calculator stay unavailable until you
              resume.
            </p>
            <button
              className="primary"
              disabled={pending}
              onClick={() => void run(async () => onResumeTest?.())}
            >
              Resume test
            </button>
            <button className="text-button" disabled={pending} onClick={onBack}>
              Exit test
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
