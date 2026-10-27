import { useState } from "react";
import type { StudyData } from "../core/model";
import {
  performanceOverview,
  reviewQueues,
  sessionOutcomes,
} from "../core/review";
import { skillKey, taxonomyOptions } from "../core/taxonomy";
import { sessionDisplayName } from "../core/sessions";

export function Review({
  data,
  protectTests,
  onStart,
  onOpen,
}: {
  data: StudyData;
  protectTests: boolean;
  onStart: (
    ids: string[],
    source?: "mistakes" | "unanswered" | "bookmarks",
  ) => void;
  onOpen: (id: string) => void;
}) {
  const [visible, setVisible] = useState(5);
  const queues = reviewQueues(data, protectTests);
  const performance = performanceOverview(data);
  const bookmarks = data.questions
    .filter(
      (q) =>
        data.annotations[q.id]?.bookmarked &&
        (!protectTests || q.testStatus !== "active"),
    )
    .map((q) => q.id);
  const protectedBookmarks =
    data.questions.filter((q) => data.annotations[q.id]?.bookmarked).length -
    bookmarks.length;
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
      <section
        className="performance-overview"
        aria-labelledby="performance-heading"
      >
        <div className="performance-heading">
          <div>
            <p className="eyebrow">PERFORMANCE SO FAR</p>
            <h2 id="performance-heading">A clear view of your answers</h2>
          </div>
          {performance.accuracy !== undefined && (
            <p className="overall-accuracy">
              <strong>{performance.accuracy}%</strong>
              <span>{performance.answered} answered</span>
            </p>
          )}
        </div>
        {performance.accuracy === undefined ? (
          <p className="muted performance-empty">
            No answered questions yet. Submitted answers will build a calm
            picture of your performance here; unanswered work remains in the
            queues below.
          </p>
        ) : (
          <>
            <p className="performance-totals">
              {performance.correct} correct · {performance.incorrect} incorrect
            </p>
            <div className="domain-performance" aria-label="Accuracy by domain">
              {performance.domains.map((domain) => (
                <div className="domain-performance-row" key={domain.key}>
                  <div>
                    <strong>{domain.domain}</strong>
                    <span>
                      {domain.section === "math" ? "Math" : "Reading & Writing"}
                    </span>
                  </div>
                  <div className="domain-performance-result">
                    <span>
                      {domain.accuracy}% · {domain.answered} answered
                      {domain.answered < 5 ? " · early sample" : ""}
                    </span>
                    <div
                      className="accuracy-track"
                      role="img"
                      aria-label={`${domain.domain}: ${domain.correct} correct out of ${domain.answered} answered`}
                    >
                      <span style={{ width: `${domain.accuracy}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="small muted performance-note">
              Accuracy is correct answers divided by submitted answers.
              Unanswered questions are not counted; repeated attempts count as
              separate answers.
            </p>
          </>
        )}
      </section>
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
            onClick={() => onStart(queues.mistakes, "mistakes")}
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
            onClick={() => onStart(queues.unanswered, "unanswered")}
          >
            Practice unanswered
          </button>
        </section>
      </div>
      <section className="bookmark-review">
        <h2>Bookmarks</h2>
        <p className="muted">
          {bookmarks.length
            ? `${bookmarks.length} saved questions ready to revisit.`
            : protectedBookmarks
              ? "Your saved questions are currently protected practice-test material."
              : "Save a question with the star or E during practice."}
          {protectedBookmarks > 0 && bookmarks.length > 0
            ? ` ${protectedBookmarks} saved questions are hidden by practice-test protection.`
            : ""}
        </p>
        <button
          disabled={!bookmarks.length}
          onClick={() => onStart(bookmarks, "bookmarks")}
        >
          Practice bookmarks
        </button>
      </section>
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
              <strong>{sessionDisplayName(data, session)}</strong>
              <small className="session-outcomes">
                {result.correct.length} correct · {result.incorrect.length}{" "}
                incorrect · {result.unanswered.length} unanswered ·{" "}
                {new Date(session.startedAt).toLocaleDateString()}
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
    </main>
  );
}
