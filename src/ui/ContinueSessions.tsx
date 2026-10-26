import type { StudyData } from "../core/model";
import { sessionOutcomes } from "../core/review";
import { sectionName } from "./Filters";

export function ContinueSessions({
  data,
  onResume,
}: {
  data: StudyData;
  onResume: (id: string) => void;
}) {
  const sessions = data.sessions.filter((s) => !s.finishedAt).toReversed();
  if (!sessions.length) return null;
  const rows = sessions.map((s) => {
    const left = sessionOutcomes(data, s).unanswered.length;
    const sections = [
      ...new Set(
        s.questionIds.map(
          (id) => data.questions.find((q) => q.id === id)?.section,
        ),
      ),
    ];
    return (
      <div className="resume-strip" key={s.id}>
        <div>
          <strong>
            {sections.length === 1 && sections[0]
              ? sectionName(sections[0])
              : "Mixed practice"}{" "}
            · {s.questionIds.length} questions
          </strong>
          <span>
            {s.questionIds.length - left} answered · {left} left ·{" "}
            {new Date(s.startedAt).toLocaleString()}
          </span>
        </div>
        <button onClick={() => onResume(s.id)}>Resume practice →</button>
      </div>
    );
  });
  return (
    <section
      className="continue-area"
      aria-label="Continue unfinished practice"
    >
      <h2>Continue</h2>
      {rows.slice(0, 3)}
      {rows.length > 3 && (
        <details className="more-unfinished">
          <summary>More unfinished sets ({rows.length - 3})</summary>
          {rows.slice(3)}
        </details>
      )}
    </section>
  );
}
