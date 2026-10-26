import { useState } from "react";
import type { StudyData } from "../core/model";
import { reviewQueues, sessionOutcomes } from "../core/review";
import { skillKey, taxonomyOptions } from "../core/taxonomy";

export function Review({
  data,
  protectTests,
  onStart,
  onOpen,
}: {
  data: StudyData;
  protectTests: boolean;
  onStart: (ids: string[]) => void;
  onOpen: (id: string) => void;
}) {
  const [visible, setVisible] = useState(5);
  const queues = reviewQueues(data, protectTests);
  const recent = data.sessions.toReversed();
  const missed = data.questions.filter((q) => queues.mistakes.includes(q.id));
  const skills = taxonomyOptions(missed, "skill")
    .map((option) => ({
      ...option,
      ids: missed.filter((q) => skillKey(q) === option.value).map((q) => q.id),
    }))
    .sort((a, b) => b.ids.length - a.ids.length);
  return (
    <main className="page narrow review-page">
      <p className="eyebrow">REFLECT & RETURN</p>
      <h1>What deserves another look?</h1>
      <p className="muted">
        Return to a mistake, finish what you left, or try a familiar set again.
      </p>
      <div className="review-paths">
        <section>
          <h2>Mistakes</h2>
          <p>
            {queues.mistakes.length
              ? `${queues.mistakes.length} questions with an incorrect latest answer.`
              : "No mistakes waiting to revisit."}
          </p>
          <button
            disabled={!queues.mistakes.length}
            onClick={() => onStart(queues.mistakes)}
          >
            Practice mistakes
          </button>
        </section>
        <section>
          <h2>Left unanswered</h2>
          <p>
            {queues.unanswered.length
              ? `${queues.unanswered.length} questions from your previous sets still have no submitted answer.`
              : "Nothing left unanswered in your sets."}
          </p>
          <button
            disabled={!queues.unanswered.length}
            onClick={() => onStart(queues.unanswered)}
          >
            Practice unanswered
          </button>
        </section>
      </div>
      <p className="small muted">
        {protectTests
          ? "Practice-test protection is on for these review sets."
          : "Review sets may include active practice-test questions."}{" "}
        A later answer updates these queues; original session results remain
        unchanged.
      </p>
      {skills.length > 0 && (
        <details className="spaced">
          <summary>Skills to revisit</summary>
          <div className="skill-list">
            {skills.slice(0, 5).map((skill) => (
              <button key={skill.value} onClick={() => onStart(skill.ids)}>
                <span>{skill.label}</span>
                <span>{skill.ids.length} to retry →</span>
              </button>
            ))}
          </div>
        </details>
      )}
      <h2 className="spaced">Your sessions</h2>
      {!recent.length && (
        <p className="muted">
          After a practice set, you can revisit its results here.
        </p>
      )}
      {recent.slice(0, visible).map((session) => {
        const result = sessionOutcomes(data, session);
        return (
          <button
            key={session.id}
            className="session-row"
            onClick={() => onOpen(session.id)}
          >
            <span>
              {new Date(session.startedAt).toLocaleString()}
              <small className="session-outcomes">
                {result.correct.length} correct · {result.incorrect.length}{" "}
                incorrect · {result.unanswered.length} unanswered
              </small>
            </span>
            <span>
              {session.finishedAt
                ? "View results & retry →"
                : "Resume practice →"}
            </span>
          </button>
        );
      })}
      {recent.length > visible && (
        <button className="load-more" onClick={() => setVisible(visible + 5)}>
          Show older sessions
        </button>
      )}
      {data.attempts.length > 0 && (
        <details className="spaced">
          <summary>Study details</summary>
          <p>
            {data.attempts.length} answers submitted ·{" "}
            <span>
              {Math.round(
                (100 * data.attempts.filter((a) => a.correct).length) /
                  data.attempts.length,
              )}
              %
            </span>{" "}
            accuracy across attempts
          </p>
        </details>
      )}
    </main>
  );
}
