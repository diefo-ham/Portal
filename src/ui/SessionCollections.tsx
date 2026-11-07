import { useMemo, useState } from "react";
import type { Session, StudyData } from "../core/model";
import { sessionDisplayName } from "../core/sessions";
import { useT } from "./i18n";
import { SessionRow } from "./SessionRow";

export interface SessionActions {
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRepractice: (session: Session) => void;
  /** The Settings choice: deleting a session also removes its answers. */
  removesAnswers?: boolean;
}

export type SessionCollectionsProps = {
  data: StudyData;
  actions: SessionActions;
};

export const SessionCollections = ({
  data,
  actions,
}: SessionCollectionsProps) => {
  const t = useT();
  const [search, setSearch] = useState("");
  const completed = data.sessions
    .filter(
      (session) =>
        !!session.finishedAt &&
        !session.practiceTest &&
        !session.timedTest &&
        !session.tsiTest,
    )
    .toReversed();
  const starred = completed.filter((session) => session.starred);
  const recent = completed.filter((session) => !session.starred).slice(0, 3);
  const all = useMemo(() => {
    const ordered = [
      ...data.sessions
        .filter(
          (session) =>
            !session.finishedAt &&
            !session.practiceTest &&
            !session.timedTest &&
            !session.tsiTest,
        )
        .toReversed(),
      ...completed.filter((session) => session.starred),
      ...completed.filter((session) => !session.starred),
    ];
    const query = search.trim().toLocaleLowerCase();
    return query
      ? ordered.filter((session) =>
          sessionDisplayName(data, session, t)
            .toLocaleLowerCase()
            .includes(query),
        )
      : ordered;
  }, [completed, data, search, t]);

  if (!completed.length) return null;
  return (
    <section className="session-collections" aria-labelledby="sessions-title">
      <h2 id="sessions-title">{t("Your sessions")}</h2>
      {starred.length > 0 && (
        <section className="session-group" aria-labelledby="starred-title">
          <h3 id="starred-title">{t("Starred")}</h3>
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
          <h3 id="recent-title">{t("Recent")}</h3>
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
          {t("View all sessions ({n})", {
            n: data.sessions.filter(
              (s) => !s.practiceTest && !s.timedTest && !s.tsiTest,
            ).length,
          })}
        </summary>
        <label className="session-search">
          <span className="sr-only">{t("Search sessions")}</span>
          <input
            type="search"
            placeholder={t("Search session names…")}
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
            <p className="small muted">
              {t("No session names match that search.")}
            </p>
          )}
        </div>
      </details>
    </section>
  );
};
