import { useState } from "react";
import { beginSession, resetStudyProgress } from "../core/commands";
import {
  defaultFilters,
  type Filters as FilterValues,
  type StudyData,
  emptyData,
} from "../core/model";
import { filterQuestions, selectSessionQuestions } from "../core/practice";
import { parseQuestions, mergeQuestions } from "../importing/json";
import { parseBackup, downloadJson } from "../importing/backup";
import synthetic from "../data/synthetic.json";
import { useStudy } from "./useStudy";
import { Practice } from "./Practice";
import { Home } from "./Home";
import { Review } from "./Review";
import { Help } from "./Help";
import { ResetProgress } from "./ResetProgress";
import { AppearanceSettings, useAppearance } from "./AppearanceSettings";
import { portableBackup, storeInlineDocuments } from "../importing/documents";
import { Browse } from "./Browse";
export function App() {
  const appearance = useAppearance();
  const { data, archive, mutate, error, setError, loadingMessage } = useStudy();
  const [page, setPage] = useState("home");
  const [protectedTests, setProtectedTests] = useState(
    () => localStorage.getItem("sat-protect-tests") !== "false",
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
  const [restore, setRestore] = useState<StudyData>();
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
  const importData = async (raw: unknown, filename: string) => {
    const incoming = (
      await storeInlineDocuments({
        ...emptyData(),
        questions: parseQuestions(raw),
      })
    ).questions;
    let report = "";
    await mutate((d) => {
      const result = mergeQuestions(d.questions, incoming, filename);
      d.questions = result.questions;
      d.imports.push({
        id: crypto.randomUUID(),
        filename,
        importedAt: new Date().toISOString(),
        added: result.added,
        skipped: result.skipped,
      });
      report = `${result.added} questions imported. ${result.skipped} duplicates skipped.`;
    });
    setMessage(report);
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 768 * 1024 * 1024)
      throw new Error("Choose a backup smaller than 768 MB.");
    const raw: unknown = JSON.parse(await file.text());
    setRestore(parseBackup(raw));
  };
  const exportBackup = (filename: string) =>
    void run(async () => {
      setMessage("Preparing a portable backup, including original PDF images…");
      downloadJson(await portableBackup(data!), filename);
      setMessage(
        "Portable backup exported, including PDF question and explanation images.",
      );
    });
  const start = async (ids: string[], size = 0, sessionFilters = filters) => {
    if (!ids.length) return;
    const selected = selectSessionQuestions(
      ids,
      size,
      data?.sessions.at(-1)?.questionIds,
    );
    if (
      data?.questions.some(
        (q) => selected.includes(q.id) && q.testStatus === "active",
      ) &&
      !window.confirm(
        "This session includes active practice-test questions and may spoil a future Bluebook test. Begin anyway?",
      )
    )
      return;
    await run(async () => {
      let id = "";
      await mutate((d) => {
        id = beginSession(d, selected, sessionFilters).id;
      });
      setSessionId(id);
      setMessage("");
      setPage("practice");
    });
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
            ].map(([id, label]) => (
              <button
                className={page === id ? "active" : ""}
                aria-current={page === id ? "page" : undefined}
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
      {page === "practice" && current ? (
        <Practice
          key={current.id}
          data={data}
          session={current}
          mutate={mutate}
          onBack={() => setPage("home")}
          onRetry={(ids) => void start(ids, 0, current.filters)}
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
          onResume={(id) => {
            setSessionId(id);
            setPage("practice");
          }}
          onReview={() => setPage("review")}
          onBrowse={() => setPage("library")}
          onSample={() =>
            void run(() => importData(synthetic, "synthetic.json"))
          }
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
          busy={busy}
          onSample={() =>
            void run(() => importData(synthetic, "synthetic.json"))
          }
          mutate={mutate}
        />
      ) : page === "review" ? (
        <Review
          data={data}
          protectTests={protectedTests}
          onStart={(ids) =>
            void start(ids, 0, {
              ...defaultFilters,
              active: protectedTests ? "hide" : "include",
            })
          }
          onOpen={(id) => {
            setSessionId(id);
            setPage("practice");
          }}
        />
      ) : (
        <main className="page narrow settings-page">
          <h1>Settings</h1>
          <AppearanceSettings appearance={appearance} />
          <section className="utility">
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
              a session in Refine selection. Unknown questions may still appear
              in a practice test.
            </p>
          </section>
          <section
            className="maintenance"
            aria-labelledby="maintenance-heading"
          >
            <h2 id="maintenance-heading">Library & maintenance</h2>
            <p className="muted">
              Question content and study history stay in this browser. No
              account, uploads, or cloud sync.
            </p>
            <div className="data-grid">
              <section className="data-card">
                <h2>Back up your work</h2>
                <p>
                  Export questions, answers, bookmarks, and sessions together.
                  Keep backups somewhere you control.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    exportBackup(
                      `sat-study-${new Date().toISOString().slice(0, 10)}.backup.json`,
                    )
                  }
                >
                  Export full backup
                </button>
                <label className="file-button secondary">
                  Restore a backup
                  <input
                    aria-label="Restore backup JSON"
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void run(() => readFile(file));
                    }}
                  />
                </label>
                <p className="small muted">
                  Use the same browser and http://127.0.0.1:4317 each time.
                  Clearing site data or using private browsing can remove your
                  library.
                </p>
              </section>
            </div>
            {restore && (
              <section className="restore-confirm" role="alert">
                <h2>Replace local data with this backup?</h2>
                <p>
                  {restore.questions.length} questions,{" "}
                  {restore.attempts.length} attempts, {restore.sessions.length}{" "}
                  sessions. This replaces the current library and history.
                </p>
                <button
                  disabled={busy}
                  onClick={() => exportBackup("before-restore.backup.json")}
                >
                  Back up current data first
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const normalized = await storeInlineDocuments(restore);
                      await mutate((d) => {
                        Object.assign(d, normalized);
                      }, {});
                      setRestore(undefined);
                      setSessionId("");
                      setMessage(
                        "Backup restored. Saved session timers are paused.",
                      );
                    })
                  }
                >
                  Replace with backup
                </button>
                <button onClick={() => setRestore(undefined)}>Cancel</button>
              </section>
            )}
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
                IndexedDB database: sat-study-local. A running local server is
                required; an internet connection is not.
              </p>
            </section>
            <h2>Import history</h2>
            {data.imports.length ? (
              data.imports
                .slice()
                .reverse()
                .map((x) => (
                  <div className="import-row" key={x.id}>
                    <span>
                      {x.filename}
                      <small>{new Date(x.importedAt).toLocaleString()}</small>
                    </span>
                    <span>
                      {x.added} added · {x.skipped} skipped
                    </span>
                  </div>
                ))
            ) : (
              <p className="muted">No imports yet.</p>
            )}
            <ResetProgress
              busy={busy}
              archiveDate={archive?.createdAt}
              onRestore={() =>
                run(async () => {
                  await mutate(() => {}, { resetArchive: "restore" });
                  setSessionId("");
                  setRestore(undefined);
                  changeFilters({ ...filters, status: "", bookmark: "" });
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
                  setRestore(undefined);
                  changeFilters({
                    ...filters,
                    status: "",
                    bookmark: "",
                  });
                  setMessage(
                    "Study progress reset. Your question bank is ready to use.",
                  );
                })
              }
            />
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
