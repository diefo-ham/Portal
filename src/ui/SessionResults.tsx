import { type ReactNode, useState } from "react";
import type { Question, Session, StudyData } from "../core/model";
import { sessionOutcomes, sessionTiming } from "../core/review";
import { sessionDisplayName } from "../core/sessions";
import { segmentLabel } from "../core/timedTest";
import { DocumentPanels } from "./DocumentPanels";
import { formatElapsed } from "./formatTime";
import { useT, type Translate } from "./i18n";
export const displayAnswer = (q: Question, value: string) =>
  q.document
    ? value
    : q.choices?.find((c) => c.id === value)
      ? `${value}. ${q.choices.find((c) => c.id === value)!.text}`
      : value;
export const correctAnswer = (q: Question, t?: Translate) =>
  q.answer.type === "choice"
    ? displayAnswer(q, q.answer.value)
    : q.answer.accepted.join(t ? t(" or ") : " or ");

export type SessionResultsProps = {
  testSummary?: ReactNode;
  data: StudyData;
  session: Session;
  mutate?: (fn: (data: StudyData) => void) => Promise<StudyData>;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
  onCalculator?: () => void;
};

export const SessionResults = ({
  data,
  session,
  mutate,
  onBack,
  onRetry,
  onCalculator,
  testSummary,
}: SessionResultsProps) => {
  const t = useT();
  const result = sessionOutcomes(data, session);
  const timing = sessionTiming(data, session);
  const [view, setView] = useState("all");
  const [expandedModule, setExpandedModule] = useState(0);
  const answered = result.correct.length + result.incorrect.length;
  const test = session.practiceTest;
  const timed = session.timedTest;
  const unscored = new Set(test?.modules.flatMap((module) => module.unscoredIds));
  // A Practice Test's modules or a PAA test's timed parts: the review is grouped,
  // one group open at a time. The PAA's is written in Spanish, like its test mode.
  const groups: { title: string; questionIds: string[] }[] | undefined = test
    ? test.modules.map((module) => ({
        title: `${module.section === "math" ? "Math" : "Reading & Writing"} — ${
          module.mix === "first"
            ? "Module 1"
            : `Module 2, ${module.mix === "higher" ? "Higher" : "Lower"} Difficulty`
        }`,
        questionIds: module.questionIds,
      }))
    : timed?.segments.map((segment) => ({
        title: segmentLabel(segment),
        questionIds: segment.questionIds,
      }));
  const copy = timed
    ? {
        eyebrow: "REPASO DE PREGUNTAS",
        heading: "Repaso por parte",
        hint: "Las preguntas permanecen cerradas hasta que las abras.",
        shown: (n: number) => `${n} mostradas`,
        empty: "Ninguna pregunta de esta parte coincide con el filtro.",
        removeBookmark: "★ Quitar el marcador",
        addBookmark: "☆ Marcar la pregunta",
        again: "Practicar otra vez",
        all: "Practicar todas las preguntas",
        note: "Abre la práctica normal. Los resultados de la prueba no cambian.",
        position: "P",
      }
    : {
        eyebrow: "QUESTION REVIEW",
        heading: "Review by module",
        hint: "Questions stay closed until you open them.",
        shown: (n: number) => `${n} shown`,
        empty: "No questions in this module match the filter.",
        removeBookmark: "★ Remove bookmark",
        addBookmark: "☆ Bookmark question",
        again: "Practice again",
        all: "Practice all questions",
        note: "Opens ordinary Practice. Test results and Practice Test question eligibility stay unchanged.",
        position: "Q",
      };
  const counts = {
    all: session.questionIds.length,
    incorrect: result.incorrect.length,
    unanswered: result.unanswered.length,
    correct: result.correct.length,
    unscored: session.questionIds.filter((id) => unscored.has(id)).length,
  };
  const matchesView = (id: string, selectedView = view) =>
    selectedView === "all" ||
    (selectedView === "unscored" && unscored.has(id)) ||
    result[selectedView as "correct" | "incorrect" | "unanswered"]?.includes(id);
  const filteredIds = session.questionIds.filter((id) => matchesView(id));
  const toggleBookmark = (id: string) =>
    mutate?.((draft) => {
      draft.annotations[id] = {
        note: draft.annotations[id]?.note || "",
        bookmarked: !draft.annotations[id]?.bookmarked,
      };
    });
  return (
    <main className="page narrow session-results">
      <button className="text-button" onClick={onBack}>
        {session.practiceTest
          ? "← Back to Practice Test"
          : t("← Back to practice")}
      </button>
      {onCalculator && (
        <button
          className="text-button result-calculator"
          onClick={onCalculator}
        >
          {t("Calculator workspace")}
        </button>
      )}
      <p className="eyebrow">
        {t("SESSION REVIEW")} · {sessionDisplayName(data, session, t)} ·{" "}
        {new Date(session.startedAt).toLocaleDateString()}
      </p>
      {testSummary || (
        <>
          <h1>
            {answered
              ? t("{correct} of {answered} answered correctly.", {
                  correct: result.correct.length,
                  answered,
                })
              : t("A place to pick up again.")}
          </h1>
          <p className="muted">
            {answered
              ? t("{percent}% accuracy on answered questions.", {
                  percent: Math.round((100 * result.correct.length) / answered),
                }) + " "
              : t("No answers submitted.") + " "}
            {result.unanswered.length
              ? t("{n} questions left unanswered.", {
                  n: result.unanswered.length,
                })
              : t("Every question answered.")}
          </p>
          {(timing.totalMs !== undefined ||
            timing.averageAnsweredMs !== undefined) && (
            <p className="session-timing-summary">
              {timing.totalMs !== undefined
                ? t("{time} active study time", {
                    time: formatElapsed(timing.totalMs),
                  })
                : ""}
              {timing.totalMs !== undefined &&
              timing.averageAnsweredMs !== undefined
                ? " · "
                : ""}
              {timing.averageAnsweredMs !== undefined
                ? t("Average {time} / answered question", {
                    time: formatElapsed(timing.averageAnsweredMs),
                  })
                : ""}
            </p>
          )}
          <div
            className="outcome-bar"
            role="img"
            aria-label={t(
              "{correct} correct, {incorrect} incorrect, {unanswered} unanswered",
              {
                correct: result.correct.length,
                incorrect: result.incorrect.length,
                unanswered: result.unanswered.length,
              },
            )}
          >
            {(["correct", "incorrect", "unanswered"] as const).map((kind) => (
              <span
                key={kind}
                className={kind}
                style={{ flex: result[kind].length }}
              />
            ))}
          </div>
          <p className="outcome-legend">
            <span>{t("{n} correct", { n: result.correct.length })}</span>
            <span>{t("{n} incorrect", { n: result.incorrect.length })}</span>
            <span>{t("{n} unanswered", { n: result.unanswered.length })}</span>
          </p>
        </>
      )}
      <section className={`next-practice ${groups ? "practice-test-actions" : ""}`}>
        <h2>
          {groups ? copy.again : t("What deserves another attempt?")}
        </h2>
        <div className="result-actions">
          {result.incorrect.length > 0 && (
            <button
              className={groups ? "" : "primary"}
              onClick={() => onRetry(result.incorrect, "mistakes")}
            >
              {t("Practice mistakes ({n})", { n: result.incorrect.length })}
            </button>
          )}
          {result.unanswered.length > 0 && (
            <button
              className={!groups && !result.incorrect.length ? "primary" : ""}
              onClick={() => onRetry(result.unanswered, "unanswered")}
            >
              {t("Practice unanswered ({n})", { n: result.unanswered.length })}
            </button>
          )}
          <button onClick={() => onRetry(session.questionIds, "entire")}>
            {groups ? copy.all : t("Practice entire session again")}
          </button>
        </div>
        <p className="small muted">
          {groups
            ? copy.note
            : t("A new shuffled set; this session’s results stay intact.")}
        </p>
      </section>
      <div className="result-list">
        {groups && (
          <div className="section-heading-row question-review-heading">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h2>{copy.heading}</h2>
            </div>
            <p className="small muted">{copy.hint}</p>
          </div>
        )}
        <label className="result-filter">
          {t("Show")}
          <select
            value={view}
            onChange={(e) => {
              const nextView = e.target.value;
              setView(nextView);
              const firstMatchingModule = groups?.findIndex((module) =>
                module.questionIds.some((id) => matchesView(id, nextView)),
              );
              if (firstMatchingModule !== undefined && firstMatchingModule >= 0)
                setExpandedModule(firstMatchingModule);
            }}
          >
            <option value="all">{t("All ({n})", { n: counts.all })}</option>
            <option value="incorrect" disabled={!counts.incorrect}>{t("Incorrect ({n})", { n: counts.incorrect })}</option>
            <option value="unanswered" disabled={!counts.unanswered}>{t("Unanswered ({n})", { n: counts.unanswered })}</option>
            <option value="correct" disabled={!counts.correct}>{t("Correct ({n})", { n: counts.correct })}</option>
            {test && <option value="unscored" disabled={!counts.unscored}>Simulated unscored ({counts.unscored})</option>}
          </select>
        </label>
        {!filteredIds.length && <p className="muted empty-result-filter">{t("No questions match this filter.")}</p>}
        {(groups ?? [{ questionIds: session.questionIds, title: undefined as string | undefined }]).map((module, moduleIndex) => {
          const ids = module.questionIds.filter((id) => matchesView(id));
          if (!ids.length && !groups) return null;
          const moduleTitle = module.title;
          return (
            <section className="question-module-group" key={moduleTitle || moduleIndex} aria-labelledby={moduleTitle ? `question-module-${moduleIndex}` : undefined}>
              {moduleTitle && (
                <h3 id={`question-module-${moduleIndex}`}>
                  <button
                    className="question-module-toggle"
                    aria-expanded={expandedModule === moduleIndex}
                    aria-controls={`question-module-panel-${moduleIndex}`}
                    onClick={() =>
                      setExpandedModule(
                        expandedModule === moduleIndex ? -1 : moduleIndex,
                      )
                    }
                  >
                    <span>{moduleTitle}</span>
                    <span className="small muted">{copy.shown(ids.length)}</span>
                  </button>
                </h3>
              )}
              {(!moduleTitle || expandedModule === moduleIndex) && (
                <div
                  className={moduleTitle ? "module-review-questions" : undefined}
                  id={moduleTitle ? `question-module-panel-${moduleIndex}` : undefined}
                >
                {ids.length === 0 && (
                  <p className="small muted module-filter-empty">
                    {copy.empty}
                  </p>
                )}
                {ids.map((id) => {
            const q = data.questions.find((q) => q.id === id)!;
            const attempt = result.attempts.get(id);
            const elapsedMs = attempt?.durationMs || session.elapsed[id];
            const modulePosition = module.questionIds.indexOf(id) + 1;
            const scoreKind = unscored.has(id) ? "Simulated unscored" : "Scored";
            const outcome = attempt ? (attempt.correct ? t("Correct") : t("Incorrect")) : t("Unanswered");
            const bookmarked = !!data.annotations[id]?.bookmarked;
            return (
              <details key={id}>
                <summary>
                  <span
                    className={
                      attempt
                        ? attempt.correct
                          ? "correct"
                          : "incorrect"
                        : "muted"
                    }
                  >
                    {outcome}
                  </span>{" "}
                  · {q.skill || q.domain || t("Question")}
                  {test && <span className="small muted"> · {scoreKind}</span>}
                  <span className="small muted">
                    {" "}· {groups ? `${copy.position}${modulePosition}/${module.questionIds.length}` : `#${session.questionIds.indexOf(id) + 1}`}
                    {elapsedMs > 0
                      ? ` · ${formatElapsed(elapsedMs)}${attempt ? "" : t(" spent")}`
                      : ""}
                  </span>
                </summary>
                {groups && mutate && (
                  <div className="post-test-question-actions">
                    <button
                      className="text-button"
                      aria-pressed={bookmarked}
                      onClick={() => void toggleBookmark(id)}
                    >
                      {bookmarked ? copy.removeBookmark : copy.addBookmark}
                    </button>
                  </div>
                )}
                {q.document ? (
                  <DocumentPanels question={q} kind="question" />
                ) : (
                  <>
                    {q.passage && <p className="passage">{q.passage}</p>}
                    <p className="question-text">{q.stem}</p>
                    {q.choices && (
                      <ol className="result-choices">
                        {q.choices.map((choice) => (
                          <li key={choice.id}>
                            {choice.id}. {choice.text}
                          </li>
                        ))}
                      </ol>
                    )}
                    {q.media?.map((media, i) => (
                      <img key={i} src={media.dataUrl} alt={media.alt} />
                    ))}
                  </>
                )}
                {attempt ? (
                  <>
                    <p>{t("Your answer: {answer}", { answer: displayAnswer(q, attempt.answer) })}</p>
                    <p>{t("Correct answer: {answer}", { answer: correctAnswer(q, t) })}</p>
                    {q.document ? (
                      <DocumentPanels question={q} kind="rationale" />
                    ) : (
                      <p>{q.rationale || t("No rationale available.")}</p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    {t(
                      "No answer submitted. Retry unanswered questions to work through this one without revealing the answer.",
                    )}
                  </p>
                )}
              </details>
            );
                })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
};
