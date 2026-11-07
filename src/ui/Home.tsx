import { useEffect } from "react";
import type { Filters as FilterValues, StudyData } from "../core/model";
import { hasImportedQuestions } from "../core/assessments";
import { filterQuestions } from "../core/practice";
import { reviewQueues } from "../core/review";
import { ContinueSessions } from "./ContinueSessions";
import { Filters } from "./Filters";
import { SessionCollections, type SessionActions } from "./SessionCollections";
import { useT } from "./i18n";

export type HomeProps = {
  data: StudyData;
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  limit: string;
  setLimit: (limit: string) => void;
  busy: boolean;
  protectTests: boolean;
  onStart: (ids: string[], size: number) => void;
  sessionActions: SessionActions;
  onReview: () => void;
  onBrowse: () => void;
  onAddQuestions: () => void;
};

export const Home = ({
  data,
  value,
  onChange,
  limit,
  setLimit,
  busy,
  protectTests,
  onStart,
  sessionActions,
  onReview,
  onBrowse,
  onAddQuestions,
}: HomeProps) => {
  const t = useT();
  const questions = filterQuestions(data, value);
  const maximum = questions.length;
  const numericLimit = Number(limit);
  useEffect(() => {
    if (maximum > 0 && /^\d+$/.test(limit) && numericLimit > maximum)
      setLimit(String(maximum));
  }, [limit, maximum, numericLimit, setLimit]);
  const validLimit =
    /^\d+$/.test(limit) &&
    Number.isInteger(numericLimit) &&
    numericLimit >= 1 &&
    numericLimit <= maximum;
  const queues = reviewQueues(data, protectTests);
  const reset = () =>
    onChange({
      section: "",
      domain: "",
      skill: "",
      difficulty: "",
      status: "",
      bookmark: "",
      search: "",
      active: protectTests ? "hide" : "include",
      domains: [],
      skills: [],
      statuses: ["unanswered"],
      difficulties: [],
    });
  return (
    <main className="page home-page">
      <p className="eyebrow">{t("YOUR PRACTICE")}</p>
      <h1>{t("What would you like to work on?")}</h1>
      <p className="muted">
        {t("Choose a focus, settle in, and take it one question at a time.")}
      </p>
      {data.questions.length > 0 && !hasImportedQuestions(data) && (
        <p className="small muted">
          {t(
            "You are working with the example questions that come with the portal. Add your own question PDFs for more, and to open the tests.",
          )}{" "}
          <button className="text-button" onClick={onAddQuestions}>
            {t("Add your question PDFs")}
          </button>
        </p>
      )}
      <ContinueSessions data={data} actions={sessionActions} />
      {!data.questions.length ? (
        <section className="empty-state">
          <h2>{t("Add your questions to begin.")}</h2>
          <p>
            {t(
              "This portal comes with no questions. Add your own College Board question PDFs and they are prepared on this device; nothing is uploaded.",
            )}
          </p>
          <button className="primary" onClick={onAddQuestions}>
            {t("Add your question PDFs")}
          </button>
        </section>
      ) : (
        <>
          <section
            className="practice-composer"
            aria-label={t("Practice selection")}
          >
            <div className="section-heading">
              <h2>{t("Choose your focus")}</h2>
              <button className="text-button" onClick={reset}>
                {t("Reset filters")}
              </button>
            </div>
            <Filters data={data} value={value} onChange={onChange} compact />
            <details className="refine-selection">
              <summary>
                {t("Refine selection")}
                {value.skills?.length ||
                value.difficulty ||
                value.difficulties?.length ||
                value.bookmark ||
                value.active !== (protectTests ? "hide" : "include")
                  ? t(" · customized")
                  : ""}
              </summary>
              <Filters data={data} value={value} onChange={onChange} advanced />
            </details>
            {value.search && (
              <p className="small muted">
                {t("Search carried over from Browse: {search}", {
                  search: value.search,
                })}{" "}
                <button
                  className="text-button"
                  onClick={() => onChange({ ...value, search: "" })}
                >
                  {t("Clear search")}
                </button>
              </p>
            )}
            <div className="composer-start">
              <label>
                {t("Session size")}
                <input
                  className="session-size-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={limit}
                  aria-invalid={limit !== "" && !validLimit}
                  aria-describedby="session-size-maximum"
                  onChange={(event) => {
                    if (/^\d*$/.test(event.target.value))
                      setLimit(event.target.value);
                  }}
                />
              </label>
              <button
                className="primary"
                disabled={busy || !validLimit}
                onClick={() =>
                  onStart(
                    questions.map((q) => q.id),
                    numericLimit,
                  )
                }
              >
                {t("Start practice →")}
              </button>
              <span className="small muted" id="session-size-maximum">
                {maximum
                  ? t("Max {n}", { n: maximum })
                  : t("No questions available")}
              </span>
            </div>
            {!questions.length && (
              <p className="muted small" role="status">
                {t(
                  "No questions match or remain for these filters. Change the filters, or reset relevant study progress in Settings to restore availability when appropriate.",
                )}
              </p>
            )}
          </section>
          <SessionCollections data={data} actions={sessionActions} />
          {(queues.mistakes.length > 0 || queues.unanswered.length > 0) && (
            <section className="gentle-review">
              <h2>{t("Something to revisit")}</h2>
              <p className="muted">
                {queues.mistakes.length > 0
                  ? t("{n} questions could use another attempt.", {
                      n: queues.mistakes.length,
                    }) + " "
                  : ""}
                {queues.unanswered.length > 0
                  ? t(
                      "{n} questions from your practice sets are still unanswered.",
                      { n: queues.unanswered.length },
                    )
                  : ""}
              </p>
              <button className="text-button" onClick={onReview}>
                {t("See what’s waiting in Review →")}
              </button>
            </section>
          )}
          <button className="text-button browse-link" onClick={onBrowse}>
            {t("Browse individual questions →")}
          </button>
        </>
      )}
    </main>
  );
};
