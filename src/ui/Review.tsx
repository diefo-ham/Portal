import { useState } from "react";
import { assessmentInfo } from "../core/assessments";
import type { StudyData } from "../core/model";
import { reviewQueues, sessionOutcomes, sessionTiming } from "../core/review";
import { sessionDisplayName } from "../core/sessions";
import { PerformanceOverview } from "./PerformanceOverview";
import { formatElapsed } from "./formatTime";
import { useAssessment, useT } from "./i18n";
import type { ReviewSource } from "@/src/types/ui";

export type ReviewProps = {
  data: StudyData;
  protectTests: boolean;
  onStart: (ids: string[], source?: ReviewSource) => void;
  onOpen: (id: string) => void;
};

export const Review = ({
  data,
  protectTests,
  onStart,
  onOpen,
}: ReviewProps) => {
  const t = useT();
  const info = assessmentInfo(useAssessment());
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
      <p className="eyebrow">{t("REFLECT & RETURN")}</p>
      <h1>{t("What deserves another look?")}</h1>
      <p className="muted">
        {t(
          "Return to a mistake, finish what you left, or try a familiar set again.",
        )}
      </p>
      <PerformanceOverview
        data={data}
        protectTests={protectTests}
        mistakeIds={queues.mistakes}
        onStart={(ids, source) => onStart(ids, source)}
      />
      <div className="review-paths">
        <section>
          <h2>{t("Mistakes")}</h2>
          <p>
            {queues.mistakes.length
              ? t("{n} questions with an incorrect latest answer.", {
                  n: queues.mistakes.length,
                })
              : t("No mistakes waiting to revisit.")}
          </p>
          <button
            disabled={!queues.mistakes.length}
            onClick={() => onStart(queues.mistakes, "mistakes")}
          >
            {t("Practice mistakes")}
          </button>
        </section>
        <section>
          <h2>{t("Left unanswered")}</h2>
          <p>
            {queues.unanswered.length
              ? t(
                  "{n} questions from your previous sets still have no submitted answer.",
                  { n: queues.unanswered.length },
                )
              : t("Nothing left unanswered in your sets.")}
          </p>
          <button
            disabled={!queues.unanswered.length}
            onClick={() => onStart(queues.unanswered, "unanswered")}
          >
            {t("Practice unanswered")}
          </button>
        </section>
        <section>
          <h2>{t("Bookmarks")}</h2>
          <p>
            {bookmarks.length
              ? t("{n} saved questions ready to revisit.", {
                  n: bookmarks.length,
                })
              : protectedBookmarks
                ? "Your saved questions are currently protected practice-test material."
                : t("Save a question with the star or E during practice.")}
            {protectedBookmarks > 0 && bookmarks.length > 0
              ? ` ${protectedBookmarks} saved questions are hidden by practice-test protection.`
              : ""}
          </p>
          <button
            disabled={!bookmarks.length}
            onClick={() => onStart(bookmarks, "bookmarks")}
          >
            {t("Practice bookmarks")}
          </button>
        </section>
      </div>
      <p className="small muted">
        {info.protectedTests &&
          (protectTests
            ? "Practice-test protection is on for these review sets."
            : "Review sets may include active practice-test questions.")}{" "}
        {t(
          "A later answer updates these queues; original session results remain unchanged.",
        )}
      </p>
      <h2 className="spaced">{t("Your sessions")}</h2>
      {!recent.length && (
        <p className="muted">
          {t("After a practice set, you can revisit its results here.")}
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
              <strong>{sessionDisplayName(data, session, t)}</strong>
              <small className="session-outcomes">
                {t("{n} correct", { n: result.correct.length })} ·{" "}
                {t("{n} incorrect", { n: result.incorrect.length })} ·{" "}
                {t("{n} unanswered", { n: result.unanswered.length })} ·{" "}
                {new Date(session.startedAt).toLocaleDateString()}
                {session.finishedAt && timing.totalMs !== undefined
                  ? ` · ${t("{time} active time", { time: formatElapsed(timing.totalMs) })}`
                  : ""}
              </small>
            </span>
            <span>
              {session.finishedAt
                ? t("View results & retry →")
                : t("Resume practice →")}
            </span>
          </button>
        );
      })}
      {recent.length > visible && (
        <button className="load-more" onClick={() => setVisible(visible + 5)}>
          {t("Show older sessions")}
        </button>
      )}
    </main>
  );
};
