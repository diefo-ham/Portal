import type { StudyData } from "../core/model";
import type { SessionActions } from "./SessionCollections";
import { useT } from "./i18n";
import { SessionRow } from "./SessionRow";

export type ContinueSessionsProps = {
  data: StudyData;
  actions: SessionActions;
};

export const ContinueSessions = ({ data, actions }: ContinueSessionsProps) => {
  const t = useT();
  const sessions = data.sessions
    .filter(
      (s) => !s.finishedAt && !s.practiceTest && !s.timedTest && !s.tsiTest,
    )
    .toReversed();
  if (!sessions.length) return null;
  const rows = sessions.map((session) => (
    <SessionRow key={session.id} data={data} session={session} {...actions} />
  ));
  return (
    <section
      className="continue-area"
      aria-label={t("Continue unfinished practice")}
    >
      <h2>{t("Continue")}</h2>
      {rows.slice(0, 3)}
      {rows.length > 3 && (
        <details className="more-unfinished">
          <summary>
            {t("More unfinished sets ({n})", { n: rows.length - 3 })}
          </summary>
          {rows.slice(3)}
        </details>
      )}
    </section>
  );
};
