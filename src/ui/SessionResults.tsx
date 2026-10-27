import { useState } from "react";
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
  onBack,
  onRetry,
}: {
  data: StudyData;
  session: Session;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
}) {
  const result = sessionOutcomes(data, session);
  const timing = sessionTiming(data, session);
  const [view, setView] = useState("all");
  const answered = result.correct.length + result.incorrect.length;
  return (
    <main className="page narrow session-results">
      <button className="text-button" onClick={onBack}>
        ← Back to practice
      </button>
      <p className="eyebrow">
        SESSION REVIEW · {sessionDisplayName(data, session)} ·{" "}
        {new Date(session.startedAt).toLocaleDateString()}
      </p>
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
      <section className="next-practice">
        <h2>What deserves another attempt?</h2>
        <div className="result-actions">
          {result.incorrect.length > 0 && (
            <button
              className="primary"
              onClick={() => onRetry(result.incorrect, "mistakes")}
            >
              Practice mistakes ({result.incorrect.length})
            </button>
          )}
          {result.unanswered.length > 0 && (
            <button
              className={!result.incorrect.length ? "primary" : ""}
              onClick={() => onRetry(result.unanswered, "unanswered")}
            >
              Practice unanswered ({result.unanswered.length})
            </button>
          )}
          <button onClick={() => onRetry(session.questionIds, "entire")}>
            Practice entire session again
          </button>
        </div>
        <p className="small muted">
          A new shuffled set; this session’s results stay intact.
        </p>
      </section>
      <div className="result-list">
        <label className="result-filter">
          Show
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">All outcomes</option>
            <option value="incorrect">Incorrect</option>
            <option value="unanswered">Unanswered</option>
            <option value="correct">Correct</option>
          </select>
        </label>
        {session.questionIds
          .filter(
            (id) =>
              view === "all" ||
              result[view as "correct" | "incorrect" | "unanswered"].includes(
                id,
              ),
          )
          .map((id) => {
            const q = data.questions.find((q) => q.id === id)!;
            const attempt = result.attempts.get(id);
            const elapsedMs = attempt?.durationMs || session.elapsed[id];
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
                    {attempt
                      ? attempt.correct
                        ? "Correct"
                        : "Incorrect"
                      : "Unanswered"}
                  </span>{" "}
                  · {q.skill || q.domain || "Question"}
                  <span className="small muted">
                    {" "}
                    · #{session.questionIds.indexOf(id) + 1}
                    {elapsedMs > 0
                      ? ` · ${formatElapsed(elapsedMs)}${attempt ? "" : " spent"}`
                      : ""}
                  </span>
                </summary>
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
    </main>
  );
}
