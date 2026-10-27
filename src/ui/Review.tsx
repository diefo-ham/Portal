import { useState } from "react";
import type { StudyData } from "../core/model";
import { reviewQueues, sessionOutcomes, sessionTiming } from "../core/review";
import { sessionDisplayName } from "../core/sessions";
import { PerformanceOverview } from "./PerformanceOverview";
import { formatElapsed } from "./formatTime";

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
  return (
    <main className="page narrow review-page">
      <p className="eyebrow">REFLECT & RETURN</p>
      <h1>What deserves another look?</h1>
      <p className="muted">
        Return to a mistake, finish what you left, or try a familiar set again.
      </p>
      <PerformanceOverview
        data={data}
        protectTests={protectTests}
        mistakeIds={queues.mistakes}
        onStart={(ids, source) => onStart(ids, source)}
      />
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
        <section>
          <h2>Bookmarks</h2>
          <p>
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
      </div>
      <p className="small muted">
        {protectTests
          ? "Practice-test protection is on for these review sets."
          : "Review sets may include active practice-test questions."}{" "}
        A later answer updates these queues; original session results remain
        unchanged.
      </p>
      <h2 className="spaced">Your sessions</h2>
      {!recent.length && (
        <p className="muted">
          After a practice set, you can revisit its results here.
        </p>
      )}
      {recent.slice(0, visible).map((session) => {
        const result = sessionOutcomes(data, session);
        const timing = sessionTiming(data, session);
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
                {session.finishedAt && timing.totalMs !== undefined
                  ? ` · ${formatElapsed(timing.totalMs)} active time`
                  : ""}
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
