import type { StudyData } from "../core/model";
import type { SessionActions } from "./SessionCollections";
import { SessionRow } from "./SessionRow";

export function ContinueSessions({
  data,
  actions,
}: {
  data: StudyData;
  actions: SessionActions;
}) {
  const sessions = data.sessions.filter((s) => !s.finishedAt).toReversed();
  if (!sessions.length) return null;
  const rows = sessions.map((session) => (
    <SessionRow key={session.id} data={data} session={session} {...actions} />
  ));
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
