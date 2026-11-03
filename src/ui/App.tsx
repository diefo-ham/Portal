import { useState } from "react";
import {
  beginSession,
  deleteSession,
  renameSession,
  resetStudyProgress,
  toggleSessionStar,
} from "../core/commands";
import {
  defaultFilters,
  type Filters as FilterValues,
  type Session,
  type StudyData,
} from "../core/model";
import { filterQuestions, selectSessionQuestions } from "../core/practice";
import { useStudy } from "./useStudy";
import { Practice } from "./Practice";
import { PracticeTestSetup, PracticeTestRun } from "./PracticeTest";
import { Home } from "./Home";
import { Review } from "./Review";
import { Help } from "./Help";
import { ResetProgress } from "./ResetProgress";
import { AppearanceSettings, useAppearance } from "./AppearanceSettings";
import { Browse } from "./Browse";
import { PdfPrepare } from "./PdfPrepare";
import { normalizeSessionName } from "../core/sessions";
export function App() {
  const appearance = useAppearance();
  const {
    data,
    archive,
    mutate,
    adoptLibrary,
    error,
    setError,
    loadingMessage,
  } = useStudy();
  const [page, setPage] = useState("home");
  const [protectedTests, setProtectedTests] = useState(
    () => localStorage.getItem("sat-protect-tests") !== "false",
  );
  const [timerDefault, setTimerDefault] = useState(
    () => localStorage.getItem("sat-timer-default") !== "false",
  );
  const [showCorrectExplanations, setShowCorrectExplanations] = useState(
    () => localStorage.getItem("sat-show-correct-explanations") === "true",
  );
  const [filters, setFilters] = useState<FilterValues>(() => ({
    ...defaultFilters,
    active:
      localStorage.getItem("sat-protect-tests") === "false"
        ? "include"
        : "hide",
  }));
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState("10");
  const [visible, setVisible] = useState(40);
  const [pendingStart, setPendingStart] = useState<{
    ids: string[];
    filters: FilterValues;
    name?: string;
  }>();
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    const selected = selectSessionQuestions(
      ids,
      size,
      data?.sessions.at(-1)?.questionIds,
    );
    const request = { ids: selected, filters: sessionFilters, name };
    if (
      data?.questions.some(
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
  const filtered = filterQuestions(data, filters);
  const current = data.sessions.find((s) => s.id === sessionId);
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
    void run(() => mutate((draft) => deleteSession(draft, id)));
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
    <>
      {!(page === "practice" && current && !current.finishedAt) && (
        <header className="app-header">
          <button className="brand" onClick={() => setPage("home")}>
            <span className="brand-icon">S</span>
            <span>
              SAT <b>Study</b>
            </span>
          </button>
          <nav aria-label="Main navigation">
            {[
              ["home", "Practice"],
              ["review", "Review"],
              ["library", "Browse"],
              ["tests", "Tests"],
            ].map(([id, label]) => (
              <button
                className={
                  page === id ||
                  (id === "tests" &&
                    page === "practice" &&
                    current?.practiceTest)
                    ? "active"
                    : ""
                }
                aria-current={
                  page === id ||
                  (id === "tests" &&
                    page === "practice" &&
                    current?.practiceTest)
                    ? "page"
                    : undefined
                }
                key={id}
                onClick={() => {
                  setPage(id);
                  setMessage("");
                }}
              >
                {label}
              </button>
            ))}
            <Help />
            <button
              className={`settings-link ${page === "data" ? "active" : ""}`}
              aria-current={page === "data" ? "page" : undefined}
              aria-label="Settings"
              title="Settings"
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
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {message && (
        <div role="status" className="banner">
          {message}
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
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
      {page === "tests" ? (
        <PracticeTestSetup
          data={data}
          mutate={mutate}
          onOpen={openSession}
          onSettings={() => setPage("data")}
        />
      ) : page === "practice" && current?.practiceTest ? (
        <PracticeTestRun
          data={data}
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
          data={data}
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
          data={data}
          value={filters}
          onChange={changeFilters}
          limit={limit}
          setLimit={setLimit}
          busy={busy}
          protectTests={protectedTests}
          onStart={(ids, size) => void start(ids, size)}
          sessionActions={{
            onOpen: openSession,
            onRename: changeSessionName,
            onDelete: removeSession,
            onToggleStar: changeSessionStar,
            onRepractice: repracticeSession,
          }}
          onReview={() => setPage("review")}
          onBrowse={() => setPage("library")}
          onAddQuestions={() => setPage("data")}
        />
      ) : page === "library" ? (
        <Browse
          data={data}
          filters={filters}
          filtered={filtered}
          visible={visible}
          onShowMore={() => setVisible(visible + 40)}
          onChangeFilters={changeFilters}
          protectTests={protectedTests}
          onAddQuestions={() => setPage("data")}
          mutate={mutate}
        />
      ) : page === "review" ? (
        <Review
          data={data}
          protectTests={protectedTests}
          onStart={(ids, source) =>
            void start(ids, 0, {
              ...defaultFilters,
              active: protectedTests ? "hide" : "include",
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
          <h1>Settings</h1>
          <AppearanceSettings appearance={appearance} />
          <section className="utility study-preferences">
            <h2>Study preferences</h2>
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
              Timer on by default
            </label>
            <p className="small muted">
              New sessions start with the timer visible. Each session remembers
              its own choice afterward.
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
              Show explanations after correct answers
            </label>
            <p className="small muted">
              When off, correct answers stay concise and the explanation remains
              available on request. Incorrect answers always show it.
            </p>
            <label>
              <input
                type="checkbox"
                checked={protectedTests}
                onChange={(e) => {
                  const protect = e.target.checked;
                  setProtectedTests(protect);
                  localStorage.setItem("sat-protect-tests", String(protect));
                  changeFilters({
                    ...filters,
                    active: protect ? "hide" : "include",
                  });
                }}
              />{" "}
              Protect unused practice-test questions
            </label>
            <p className="small muted">
              Active questions are hidden by default. You can override this for
              a session in Refine selection. Unknown status is not a guarantee
              against future College Board test spoilers.
            </p>
          </section>
          <section
            className="maintenance"
            aria-labelledby="maintenance-heading"
          >
            <h2 id="maintenance-heading">Your questions</h2>
            <p className="muted">
              {data.questions.length
                ? `${data.questions.length.toLocaleString()} questions are stored in this browser, with your answers and notes.`
                : "No questions yet. Add your PDFs below, or try the sample questions from the Practice page."}{" "}
              Nothing is uploaded, and no account is needed.
            </p>
            <div className="data-grid">
              <PdfPrepare prepare={preparePdfs} />
            </div>
            <ResetProgress
              busy={busy}
              archiveDate={archive?.createdAt}
              onRestore={() =>
                run(async () => {
                  await mutate(() => {}, { resetArchive: "restore" });
                  setSessionId("");
                  changeFilters({
                    ...filters,
                    status: "",
                    statuses: [],
                    bookmark: "",
                  });
                  setMessage(
                    "Previous study state restored. Saved timers are paused.",
                  );
                })
              }
              onConfirm={(clearBookmarks) =>
                run(async () => {
                  await mutate((d) => resetStudyProgress(d, clearBookmarks), {
                    resetArchive: "save",
                  });
                  setSessionId("");
                  changeFilters({
                    ...filters,
                    status: "",
                    statuses: [],
                    bookmark: "",
                  });
                  setMessage(
                    "Study progress reset. Your question bank is ready to use.",
                  );
                })
              }
            />
            <section className="local-storage-note">
              <h3>Stored on this device</h3>
              <p>
                {data.questions.length} questions · {data.attempts.length}{" "}
                attempts ·{" "}
                {
                  Object.values(data.annotations).filter((a) => a.bookmarked)
                    .length
                }{" "}
                bookmarks
              </p>
              <p className="small muted">
                Everything lives in this browser, so clearing its site data for{" "}
                {location.origin} removes it.
              </p>
            </section>
          </section>
        </main>
      )}
      {page === "data" && (
        <footer className="app-footer">
          <span>Made for focused, independent study.</span>
          <span>Personal practice · Not affiliated with College Board</span>
        </footer>
      )}
    </>
  );
}
