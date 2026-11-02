import { useMemo, useState } from "react";
import type { Session, StudyData } from "../core/model";
import { sessionDisplayName } from "../core/sessions";
import { SessionRow } from "./SessionRow";

export interface SessionActions {
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRepractice: (session: Session) => void;
}

export function SessionCollections({
  data,
  actions,
}: {
  data: StudyData;
  actions: SessionActions;
}) {
  const [search, setSearch] = useState("");
  const completed = data.sessions
    .filter((session) => !!session.finishedAt && !session.practiceTest)
    .toReversed();
  const starred = completed.filter((session) => session.starred);
  const recent = completed.filter((session) => !session.starred).slice(0, 3);
  const all = useMemo(() => {
    const ordered = [
      ...data.sessions
        .filter((session) => !session.finishedAt && !session.practiceTest)
        .toReversed(),
      ...completed.filter((session) => session.starred),
      ...completed.filter((session) => !session.starred),
    ];
    const query = search.trim().toLocaleLowerCase();
    return query
      ? ordered.filter((session) =>
          sessionDisplayName(data, session).toLocaleLowerCase().includes(query),
        )
      : ordered;
  }, [completed, data, search]);

  if (!completed.length) return null;
  return (
    <section className="session-collections" aria-labelledby="sessions-title">
      <h2 id="sessions-title">Your sessions</h2>
      {starred.length > 0 && (
        <section className="session-group" aria-labelledby="starred-title">
          <h3 id="starred-title">Starred</h3>
          {starred.slice(0, 3).map((session) => (
            <SessionRow
              key={session.id}
              data={data}
              session={session}
              {...actions}
            />
          ))}
        </section>
      )}
      {recent.length > 0 && (
        <section className="session-group" aria-labelledby="recent-title">
          <h3 id="recent-title">Recent</h3>
          {recent.map((session) => (
            <SessionRow
              key={session.id}
              data={data}
              session={session}
              {...actions}
            />
          ))}
        </section>
      )}
      <details className="session-history">
        <summary>
          View all sessions (
          {data.sessions.filter((s) => !s.practiceTest).length})
        </summary>
        <label className="session-search">
          <span className="sr-only">Search sessions</span>
          <input
            type="search"
            placeholder="Search session names…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="session-history-list">
          {all.map((session) => (
            <SessionRow
              key={session.id}
              data={data}
              session={session}
              {...actions}
            />
          ))}
          {!all.length && (
            <p className="small muted">No session names match that search.</p>
          )}
        </div>
      </details>
    </section>
  );
}
