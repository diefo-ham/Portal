import { type ReactNode, useState } from "react";
import type { Question, Session, StudyData } from "../core/model";
import { sessionOutcomes, sessionTiming } from "../core/review";
import { sessionDisplayName } from "../core/sessions";
import { DocumentPanels } from "./DocumentPanels";
import { formatElapsed } from "./formatTime";
export const displayAnswer = (q: Question, value: string) =>
  q.document
    ? value
    : q.choices?.find((c) => c.id === value)
      ? `${value}. ${q.choices.find((c) => c.id === value)!.text}`
      : value;
export const correctAnswer = (q: Question) =>
  q.answer.type === "choice"
    ? displayAnswer(q, q.answer.value)
    : q.answer.accepted.join(" or ");

export function SessionResults({
  data,
  session,
  mutate,
  onBack,
  onRetry,
  onCalculator,
  testSummary,
}: {
  testSummary?: ReactNode;
  data: StudyData;
  session: Session;
  mutate?: (fn: (data: StudyData) => void) => Promise<StudyData>;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
  onCalculator?: () => void;
}) {
  const result = sessionOutcomes(data, session);
  const timing = sessionTiming(data, session);
  const [view, setView] = useState("all");
  const [expandedModule, setExpandedModule] = useState(0);
  const answered = result.correct.length + result.incorrect.length;
  const test = session.practiceTest;
  const unscored = new Set(test?.modules.flatMap((module) => module.unscoredIds));
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
          : "← Back to practice"}
      </button>
      {onCalculator && (
        <button
          className="text-button result-calculator"
          onClick={onCalculator}
        >
          Calculator workspace
        </button>
      )}
      <p className="eyebrow">
        SESSION REVIEW · {sessionDisplayName(data, session)} ·{" "}
        {new Date(session.startedAt).toLocaleDateString()}
      </p>
      {testSummary || (
        <>
          <h1>
            {answered
              ? `${result.correct.length} of ${answered} answered correctly.`
              : "A place to pick up again."}
          </h1>
          <p className="muted">
            {answered
              ? `${Math.round((100 * result.correct.length) / answered)}% accuracy on answered questions. `
              : "No answers submitted. "}
            {result.unanswered.length
              ? `${result.unanswered.length} questions left unanswered.`
              : "Every question answered."}
          </p>
          {(timing.totalMs !== undefined ||
            timing.averageAnsweredMs !== undefined) && (
            <p className="session-timing-summary">
              {timing.totalMs !== undefined
                ? `${formatElapsed(timing.totalMs)} active study time`
                : ""}
              {timing.totalMs !== undefined &&
              timing.averageAnsweredMs !== undefined
                ? " · "
                : ""}
              {timing.averageAnsweredMs !== undefined
                ? `Average ${formatElapsed(timing.averageAnsweredMs)} / answered question`
                : ""}
            </p>
          )}
          <div
            className="outcome-bar"
            role="img"
            aria-label={`${result.correct.length} correct, ${result.incorrect.length} incorrect, ${result.unanswered.length} unanswered`}
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
            <span>{result.correct.length} correct</span>
            <span>{result.incorrect.length} incorrect</span>
            <span>{result.unanswered.length} unanswered</span>
          </p>
        </>
      )}
      <section className={`next-practice ${test ? "practice-test-actions" : ""}`}>
        <h2>{test ? "Practice again" : "What deserves another attempt?"}</h2>
        <div className="result-actions">
          {result.incorrect.length > 0 && (
            <button
              className={test ? "" : "primary"}
              onClick={() => onRetry(result.incorrect, "mistakes")}
            >
              Practice mistakes ({result.incorrect.length})
            </button>
          )}
          {result.unanswered.length > 0 && (
            <button
              className={!test && !result.incorrect.length ? "primary" : ""}
              onClick={() => onRetry(result.unanswered, "unanswered")}
            >
              Practice unanswered ({result.unanswered.length})
            </button>
          )}
          <button onClick={() => onRetry(session.questionIds, "entire")}>
            {session.practiceTest
              ? "Practice all questions"
              : "Practice entire session again"}
          </button>
        </div>
        <p className="small muted">
          {session.practiceTest
            ? "Opens ordinary Practice. Test results and Practice Test question eligibility stay unchanged."
            : "A new shuffled set; this session’s results stay intact."}
        </p>
      </section>
      <div className="result-list">
        {test && (
          <div className="section-heading-row question-review-heading">
            <div>
              <p className="eyebrow">QUESTION REVIEW</p>
              <h2>Review by module</h2>
            </div>
            <p className="small muted">Questions stay closed until you open them.</p>
          </div>
        )}
        <label className="result-filter">
          Show
          <select
            value={view}
            onChange={(e) => {
              const nextView = e.target.value;
              setView(nextView);
              const firstMatchingModule = test?.modules.findIndex((module) =>
                module.questionIds.some((id) => matchesView(id, nextView)),
              );
              if (firstMatchingModule !== undefined && firstMatchingModule >= 0)
                setExpandedModule(firstMatchingModule);
            }}
          >
            <option value="all">All ({counts.all})</option>
            <option value="incorrect" disabled={!counts.incorrect}>Incorrect ({counts.incorrect})</option>
            <option value="unanswered" disabled={!counts.unanswered}>Unanswered ({counts.unanswered})</option>
            <option value="correct" disabled={!counts.correct}>Correct ({counts.correct})</option>
            {test && <option value="unscored" disabled={!counts.unscored}>Simulated unscored ({counts.unscored})</option>}
          </select>
        </label>
        {!filteredIds.length && <p className="muted empty-result-filter">No questions match this filter.</p>}
        {(test?.modules || [{ questionIds: session.questionIds, section: undefined, mix: undefined }]).map((module, moduleIndex) => {
          const ids = module.questionIds.filter((id) => matchesView(id));
          if (!ids.length && !test) return null;
          const moduleTitle = module.section
            ? `${module.section === "math" ? "Math" : "Reading & Writing"} — ${
                module.mix === "first"
                  ? "Module 1"
                  : `Module 2, ${module.mix === "higher" ? "Higher" : "Lower"} Difficulty`
              }`
            : undefined;
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
                    <span className="small muted">{ids.length} shown</span>
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
                    No questions in this module match the filter.
                  </p>
                )}
                {ids.map((id) => {
            const q = data.questions.find((q) => q.id === id)!;
            const attempt = result.attempts.get(id);
            const elapsedMs = attempt?.durationMs || session.elapsed[id];
            const modulePosition = module.questionIds.indexOf(id) + 1;
            const scoreKind = unscored.has(id) ? "Simulated unscored" : "Scored";
            const outcome = attempt ? (attempt.correct ? "Correct" : "Incorrect") : "Unanswered";
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
                  · {q.skill || q.domain || "Question"}
                  {test && <span className="small muted"> · {scoreKind}</span>}
                  <span className="small muted">
                    {" "}· {test ? `Q${modulePosition}/${module.questionIds.length}` : `#${session.questionIds.indexOf(id) + 1}`}
                    {elapsedMs > 0
                      ? ` · ${formatElapsed(elapsedMs)}${attempt ? "" : " spent"}`
                      : ""}
                  </span>
                </summary>
                {test && mutate && (
                  <div className="post-test-question-actions">
                    <button
                      className="text-button"
                      aria-pressed={bookmarked}
                      onClick={() => void toggleBookmark(id)}
                    >
                      {bookmarked ? "★ Remove bookmark" : "☆ Bookmark question"}
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
                    <p>Your answer: {displayAnswer(q, attempt.answer)}</p>
                    <p>Correct answer: {correctAnswer(q)}</p>
                    {q.document ? (
                      <DocumentPanels question={q} kind="rationale" />
                    ) : (
                      <p>{q.rationale || "No rationale available."}</p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    No answer submitted. Retry unanswered questions to work
                    through this one without revealing the answer.
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
}
