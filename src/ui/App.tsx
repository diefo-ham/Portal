import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ASSESSMENTS,
  assessmentInfo,
  isAssessment,
  scopeStudyData,
} from "../core/assessments";
import {
  beginSession,
  deleteSession,
  renameSession,
  resetStudyProgress,
  toggleSessionStar,
} from "../core/commands";
import {
  defaultFilters,
  type Assessment,
  type Filters as FilterValues,
  type Session,
  type StudyData,
} from "../core/model";
import { filterQuestions, selectSessionQuestionIds } from "../core/practice";
import { useStudy } from "./useStudy";
import { Practice } from "./Practice";
import { PracticeTestSetup, PracticeTestRun } from "./PracticeTest";
import { Home } from "./Home";
import { Review } from "./Review";
import { Help } from "./Help";
import { ResetProgress } from "./ResetProgress";
import { ClearData } from "./ClearData";
import { applyUpdate, subscribeToUpdates, updateReady } from "../updates";
import {
  eraseAllLocalData,
  removePdfQuestions,
  removeQuestionLibrary,
  storageErrorMessage,
} from "../storage/localData";
import { AppearanceSettings, useAppearance } from "./AppearanceSettings";
import { Browse } from "./Browse";
import { AddPdfsDialog } from "./AddPdfsDialog";
import { PdfManager } from "./PdfManager";
import { normalizeSessionName } from "../core/sessions";
import { AssessmentProvider, translator } from "./i18n";
import { TimedTestRun, TimedTestSetup } from "./TimedTest";

/** Which test the person last used; a fresh browser starts on the SAT. */
const LAST_KEY = "sat-last-assessment";
const remembered = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the choice just is not remembered */
  }
};
/** Hash routes work on any static host; no server rewrite is needed. */
const routeOf = (): Assessment | undefined => {
  const hash = location.hash.toLowerCase();
  return hash.startsWith("#/paa")
    ? "PAA"
    : hash.startsWith("#/sat")
      ? "SAT"
      : undefined;
};
const lastChoice = (): Assessment | undefined => {
  const last = remembered(LAST_KEY);
  return isAssessment(last) ? last : undefined;
};
export function App() {
  const appearance = useAppearance();
  const [assessment, setAssessment] = useState<Assessment>(
    () => routeOf() ?? lastChoice() ?? "SAT",
  );
  const info = assessmentInfo(assessment);
  const otherAssessment = assessmentInfo(
    ASSESSMENTS.find((id) => id !== assessment)!,
  );
  const t = useMemo(() => translator(assessment), [assessment]);
  const {
    data,
    archive,
    mutate,
    adoptLibrary,
    error,
    setError,
    loadingMessage,
  } = useStudy(assessment);
  const scoped = useMemo(
    () => (data ? scopeStudyData(data, assessment) : undefined),
    [data, assessment],
  );
  const [page, setPage] = useState("home");
  const [protectedTests, setProtectedTests] = useState(
    () => localStorage.getItem("sat-protect-tests") !== "false",
  );
  const [timerDefault, setTimerDefault] = useState(
    () => localStorage.getItem("sat-timer-default") !== "false",
  );
  const [deleteRemovesAnswers, setDeleteRemovesAnswers] = useState(
    () => localStorage.getItem("sat-delete-removes-answers") === "true",
  );
  const [showCorrectExplanations, setShowCorrectExplanations] = useState(
    () => localStorage.getItem("sat-show-correct-explanations") === "true",
  );
  const protect = info.protectedTests && protectedTests;
  const [filters, setFilters] = useState<FilterValues>(() => ({
    ...defaultFilters,
    active:
      localStorage.getItem("sat-protect-tests") === "false" ||
      !assessmentInfo(routeOf() ?? "SAT").protectedTests
        ? "include"
        : "hide",
  }));
  const [sessionId, setSessionId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const newVersion = useSyncExternalStore(subscribeToUpdates, updateReady);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState("10");
  const [visible, setVisible] = useState(40);
  const [pendingStart, setPendingStart] = useState<{
    ids: string[];
    filters: FilterValues;
    name?: string;
  }>();
  const choose = (next: Assessment) => {
    remember(LAST_KEY, next);
    const hash = "#/" + next.toLowerCase();
    if (location.hash.toLowerCase() !== hash) location.hash = hash;
    setAssessment(next);
  };
  // Screen readers and spell-checkers follow the test's language.
  useEffect(() => {
    document.documentElement.lang = info.language;
  }, [info.language]);
  useEffect(() => {
    const sync = () => {
      const linked = routeOf();
      if (linked) setAssessment(linked);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  // Switching tests starts that test's own home, with its own filters.
  useEffect(() => {
    setPage("home");
    setSessionId("");
    setMessage("");
    setVisible(40);
    setFilters({
      ...defaultFilters,
      active: protect ? "hide" : "include",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(storageErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // The PDF reader is loaded only when someone prepares a library from PDFs.
  const preparePdfs = async (
    files: File[],
    options: Parameters<
      (typeof import("../importing/pdf/run"))["prepareFromPdfs"]
    >[1],
  ) => {
    const { prepareFromPdfs } = await import("../importing/pdf/run");
    return adoptLibrary(() => prepareFromPdfs(files, options));
  };
  const preparePaaPdfs = async (
    files: File[],
    options: Parameters<
      (typeof import("../importing/pdf/run"))["prepareFromPaaPdfs"]
    >[1],
  ) => {
    const { prepareFromPaaPdfs } = await import("../importing/pdf/run");
    return adoptLibrary(() => prepareFromPaaPdfs(files, options));
  };
  const beginSelectedSession = async ({
    ids,
    filters: sessionFilters,
    name,
  }: {
    ids: string[];
    filters: FilterValues;
    name?: string;
  }) => {
    await run(async () => {
      let id = "";
      await mutate((d) => {
        id = beginSession(d, ids, sessionFilters, name, timerDefault).id;
      });
      setSessionId(id);
      setMessage("");
      setPage("practice");
    });
  };
  const start = async (
    ids: string[],
    size = 0,
    sessionFilters = filters,
    name?: string,
  ) => {
    if (!ids.length) return;
    const selected = selectSessionQuestionIds(
      scoped?.questions ?? [],
      ids,
      size,
      scoped?.sessions.at(-1)?.questionIds,
    );
    const request = { ids: selected, filters: sessionFilters, name };
    if (
      info.protectedTests &&
      scoped?.questions.some(
        (q) => selected.includes(q.id) && q.testStatus === "active",
      )
    ) {
      setPendingStart(request);
      return;
    }
    await beginSelectedSession(request);
  };
  if (!data)
    return (
      <main className="page">
        <h1>SAT Study</h1>
        <p>{error || loadingMessage}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </main>
    );
  const view = scoped ?? data;
  const filtered = filterQuestions(view, filters);
  const current = view.sessions.find((s) => s.id === sessionId);
  const changeFilters = (value: FilterValues) => {
    setFilters(value);
    setVisible(40);
  };
  const openSession = (id: string) => {
    setSessionId(id);
    setPage("practice");
  };
  const changeSessionName = (id: string, name: string) =>
    void run(() => mutate((draft) => renameSession(draft, id, name)));
  const changeSessionStar = (id: string) =>
    void run(() => mutate((draft) => toggleSessionStar(draft, id)));
  const removeSession = (id: string) =>
    void run(() =>
      mutate((draft) => deleteSession(draft, id, deleteRemovesAnswers)),
    );
  const repracticeSession = (session: Session) =>
    void start(
      session.questionIds,
      0,
      session.filters,
      session.name
        ? normalizeSessionName(`${session.name} — Repractice`)
        : undefined,
    );
  return (
    <AssessmentProvider value={assessment}>
      {!(page === "practice" && current && !current.finishedAt) && (
        <header className="app-header">
          <button className="brand" onClick={() => setPage("home")}>
            <span className="brand-icon">{info.name[0]}</span>
            <span>
              {info.name} <b>Study</b>
            </span>
          </button>
          <button
            className="assessment-toggle"
            aria-label={t("Test: {name}. Switch to {other}", {
              name: info.name,
              other: otherAssessment.name,
            })}
            title={t("Switch to {other}", { other: otherAssessment.name })}
            onClick={() => choose(otherAssessment.id)}
          >
            {info.name} ⇄
          </button>
          <nav aria-label={t("Main navigation")}>
            {[
              ["home", "Practice"],
              ["review", "Review"],
              ["library", "Browse"],
              ...(info.practiceTests
                ? [["tests", "Tests"]]
                : info.testMode
                  ? [["tests", "Test mode"]]
                  : []),
            ].map(([id, label]) => (
              <button
                className={
                  page === id ||
                  (id === "tests" &&
                    page === "practice" &&
                    (current?.practiceTest || current?.timedTest))
                    ? "active"
                    : ""
                }
                aria-current={
                  page === id ||
                  (id === "tests" &&
                    page === "practice" &&
                    (current?.practiceTest || current?.timedTest))
                    ? "page"
                    : undefined
                }
                key={id}
                onClick={() => {
                  setPage(id);
                  setMessage("");
                }}
              >
                {t(label)}
              </button>
            ))}
            <Help />
            <button
              className={`settings-link ${page === "data" ? "active" : ""}`}
              aria-current={page === "data" ? "page" : undefined}
              aria-label={t("Settings")}
              title={t("Settings")}
              onClick={() => {
                setPage("data");
                setMessage("");
              }}
            >
              ⚙
            </button>
          </nav>
        </header>
      )}
      {error && (
        <div role="alert" className="banner error">
          {error}
          <button onClick={() => setError("")} aria-label={t("Dismiss error")}>
            ×
          </button>
        </div>
      )}
      {newVersion && (
        <div role="status" className="banner">
          {t("A new version of the portal is ready.")}
          <button onClick={applyUpdate}>{t("Reload to update")}</button>
        </div>
      )}
      {message && (
        <div role="status" className="banner">
          {message}
          <button onClick={() => setMessage("")} aria-label={t("Dismiss message")}>
            ×
          </button>
        </div>
      )}
      {pendingStart && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-question-warning-heading"
          >
            <p className="eyebrow">ACTIVE PRACTICE-TEST QUESTIONS</p>
            <h2 id="active-question-warning-heading">
              Practice these questions again?
            </h2>
            <p>
              This session includes active practice-test questions and may spoil
              a future Bluebook test.
            </p>
            <div className="modal-actions">
              <button onClick={() => setPendingStart(undefined)}>Cancel</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  const request = pendingStart;
                  setPendingStart(undefined);
                  void beginSelectedSession(request);
                }}
              >
                Begin anyway
              </button>
            </div>
          </section>
        </div>
      )}
      {page === "tests" && info.testMode ? (
        <TimedTestSetup
          data={view}
          mutate={mutate}
          onOpen={openSession}
          removesAnswers={deleteRemovesAnswers}
          onAddQuestions={() => setAddOpen(true)}
        />
      ) : page === "practice" && current?.timedTest ? (
        <TimedTestRun
          data={view}
          session={current}
          mutate={mutate}
          onBack={() => setPage("tests")}
          onRetry={(ids, kind) =>
            void start(ids, 0, {
              ...defaultFilters,
              active: "include",
              statuses:
                kind === "mistakes"
                  ? ["incorrect"]
                  : kind === "unanswered"
                    ? ["unanswered"]
                    : [],
              status:
                kind === "mistakes"
                  ? "incorrect"
                  : kind === "unanswered"
                    ? "unanswered"
                    : "",
            })
          }
        />
      ) : page === "tests" && info.practiceTests ? (
        <PracticeTestSetup
          data={view}
          mutate={mutate}
          onOpen={openSession}
          onSettings={() => setPage("data")}
        />
      ) : page === "practice" && current?.practiceTest ? (
        <PracticeTestRun
          data={view}
          session={current}
          mutate={mutate}
          onBack={() => setPage("tests")}
          onRetry={(ids, kind) =>
            void start(ids, 0, {
              ...defaultFilters,
              active: "only",
              statuses: [],
              status:
                kind === "mistakes"
                  ? "incorrect"
                  : kind === "unanswered"
                    ? "unanswered"
                    : "",
            })
          }
        />
      ) : page === "practice" && current ? (
        <Practice
          key={current.id}
          data={view}
          session={current}
          mutate={mutate}
          showCorrectExplanations={showCorrectExplanations}
          onBack={() => setPage("home")}
          onRetry={(ids, kind) =>
            void start(
              ids,
              0,
              {
                ...current.filters,
                ...(kind === "mistakes"
                  ? { status: "incorrect", statuses: ["incorrect" as const] }
                  : {}),
                ...(kind === "unanswered"
                  ? { status: "unanswered", statuses: ["unanswered" as const] }
                  : {}),
              },
              current.name
                ? normalizeSessionName(
                    `${current.name} — ${kind === "entire" ? "Repractice" : kind === "mistakes" ? "Mistakes" : "Unanswered"}`,
                  )
                : undefined,
            )
          }
        />
      ) : page === "home" ? (
        <Home
          data={view}
          value={filters}
          onChange={changeFilters}
          limit={limit}
          setLimit={setLimit}
          busy={busy}
          protectTests={protect}
          onStart={(ids, size) => void start(ids, size)}
          sessionActions={{
            onOpen: openSession,
            onRename: changeSessionName,
            onDelete: removeSession,
            onToggleStar: changeSessionStar,
            onRepractice: repracticeSession,
            removesAnswers: deleteRemovesAnswers,
          }}
          onReview={() => setPage("review")}
          onBrowse={() => setPage("library")}
          onAddQuestions={() => setAddOpen(true)}
        />
      ) : page === "library" ? (
        <Browse
          data={view}
          filters={filters}
          filtered={filtered}
          visible={visible}
          onShowMore={() => setVisible(visible + 40)}
          onChangeFilters={changeFilters}
          protectTests={protect}
          onAddQuestions={() => setAddOpen(true)}
          mutate={mutate}
        />
      ) : page === "review" ? (
        <Review
          data={view}
          protectTests={protect}
          onStart={(ids, source) =>
            void start(ids, 0, {
              ...defaultFilters,
              active: protect ? "hide" : "include",
              status:
                source === "mistakes"
                  ? "incorrect"
                  : source === "unanswered"
                    ? "unanswered"
                    : "",
              statuses:
                source === "mistakes"
                  ? ["incorrect"]
                  : source === "unanswered"
                    ? ["unanswered"]
                    : [],
              bookmark: source === "bookmarks" ? "yes" : "",
            })
          }
          onOpen={openSession}
        />
      ) : (
        <main className="page narrow settings-page">
          <h1>{t("Settings")}</h1>
          <AppearanceSettings appearance={appearance} />
          <section className="utility study-preferences">
            <h2>{t("Study preferences")}</h2>
            <label>
              <input
                type="checkbox"
                checked={timerDefault}
                onChange={(e) => {
                  setTimerDefault(e.target.checked);
                  localStorage.setItem(
                    "sat-timer-default",
                    String(e.target.checked),
                  );
                }}
              />{" "}
              {t("Timer on by default")}
            </label>
            <p className="small muted">
              {t(
                "New sessions start with the timer visible. Each session remembers its own choice afterward.",
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={showCorrectExplanations}
                onChange={(e) => {
                  setShowCorrectExplanations(e.target.checked);
                  localStorage.setItem(
                    "sat-show-correct-explanations",
                    String(e.target.checked),
                  );
                }}
              />{" "}
              {t("Show explanations after correct answers")}
            </label>
            <p className="small muted">
              {t(
                "When off, correct answers stay concise and the explanation remains available on request. Incorrect answers always show it.",
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={deleteRemovesAnswers}
                onChange={(e) => {
                  setDeleteRemovesAnswers(e.target.checked);
                  localStorage.setItem(
                    "sat-delete-removes-answers",
                    String(e.target.checked),
                  );
                }}
              />{" "}
              {t("Deleting a session also removes its answers")}
            </label>
            <p className="small muted">
              {t(
                "Off by default: a deleted session leaves your answers, mistakes and accuracy as they are. On: its answers are removed from your progress, and those questions become unanswered again.",
              )}
            </p>
            {info.protectedTests && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={protectedTests}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setProtectedTests(next);
                      localStorage.setItem("sat-protect-tests", String(next));
                      changeFilters({
                        ...filters,
                        active: next ? "hide" : "include",
                      });
                    }}
                  />{" "}
                  Protect unused practice-test questions
                </label>
                <p className="small muted">
                  Active questions are hidden by default. You can override this
                  for a session in Refine selection. Unknown status is not a
                  guarantee against future College Board test spoilers.
                </p>
              </>
            )}
          </section>
          <section
            className="maintenance"
            aria-labelledby="maintenance-heading"
          >
            <h2 id="maintenance-heading">{t("Your questions")}</h2>
            <p className="muted">
              {view.questions.length
                ? t(
                    "{n} questions are stored in this browser, with your answers.",
                    { n: view.questions.length.toLocaleString() },
                  )
                : t("No questions yet. Add your PDFs below.")}{" "}
              {t("Nothing is uploaded, and no account is needed.")}
            </p>
            <div className="data-grid">
              <PdfManager
                data={view}
                busy={busy}
                onAdd={() => setAddOpen(true)}
                onRemove={(key) =>
                  run(async () => {
                    await adoptLibrary(async () => ({
                      result: { data: await removePdfQuestions(assessment, key) },
                    }));
                    setSessionId("");
                    setMessage(
                      t(
                        "PDF removed. Add it again whenever you like; your answers and bookmarks were kept.",
                      ),
                    );
                  })
                }
              />
            </div>
            <ResetProgress
              busy={busy}
              archiveDate={archive?.createdAt}
              onRestore={() =>
                run(async () => {
                  await mutate(() => {}, {
                    resetArchive: "restore",
                    assessment,
                  });
                  setSessionId("");
                  changeFilters({
                    ...filters,
                    status: "",
                    statuses: [],
                    bookmark: "",
                  });
                  setMessage(
                    t("Previous study state restored. Saved timers are paused."),
                  );
                })
              }
              onConfirm={(clearBookmarks) =>
                run(async () => {
                  await mutate(
                    (d) => resetStudyProgress(d, clearBookmarks, assessment),
                    { resetArchive: "save", assessment },
                  );
                  setSessionId("");
                  changeFilters({
                    ...filters,
                    status: "",
                    statuses: [],
                    bookmark: "",
                  });
                  setMessage(
                    t("Study progress reset. Your question bank is ready to use."),
                  );
                })
              }
            />
            <ClearData
              busy={busy}
              hasQuestions={view.questions.length > 0}
              onRemoveQuestions={() =>
                run(async () => {
                  await adoptLibrary(async () => ({
                    result: { data: await removeQuestionLibrary(assessment) },
                  }));
                  setSessionId("");
                  setMessage(
                    t("Questions removed. Add your PDFs again whenever you like."),
                  );
                })
              }
              onEraseEverything={() =>
                run(async () => {
                  await eraseAllLocalData();
                  location.reload();
                })
              }
            />
            <section className="local-storage-note">
              <h3>{t("Stored on this device")}</h3>
              <p>
                {t("{questions} questions · {attempts} attempts · {bookmarks} bookmarks", {
                  questions: view.questions.length,
                  attempts: view.attempts.length,
                  bookmarks: Object.values(view.annotations).filter(
                    (a) => a.bookmarked,
                  ).length,
                })}
              </p>
              <p className="small muted">
                {t(
                  "Everything lives in this browser, so clearing its site data for {origin} also removes it. Safari can also clear a site's data after about a week without a visit.",
                  { origin: location.origin },
                )}
              </p>
            </section>
          </section>
        </main>
      )}
      {page === "data" && (
        <footer className="app-footer">
          <span>{t("Made for focused, independent study.")}</span>
          <span>{t("Personal practice · Not affiliated with College Board")}</span>
        </footer>
      )}
      <AddPdfsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prepareSat={preparePdfs}
        preparePaa={preparePaaPdfs}
      />
    </AssessmentProvider>
  );
}
