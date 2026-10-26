import { useState } from "react";
import { beginSession } from "../core/commands";
import {
  defaultFilters,
  type Filters as FilterValues,
  type StudyData,
  emptyData,
} from "../core/model";
import { filterQuestions, latestAttempt, summarize } from "../core/practice";
import { parseQuestions, mergeQuestions } from "../importing/json";
import { parseBackup, downloadJson } from "../importing/backup";
import synthetic from "../data/synthetic.json";
import { useStudy } from "./useStudy";
import { Filters, sectionName } from "./Filters";
import { Practice } from "./Practice";
import { portableBackup, storeInlineDocuments } from "../importing/documents";
export function App() {
  const { data, mutate, error, setError, saving, loadingMessage } = useStudy();
  const [page, setPage] = useState("library");
  const [filters, setFilters] = useState<FilterValues>({ ...defaultFilters });
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(10);
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
  const readFile = async (file: File | undefined, backup = false) => {
    if (!file) return;
    if (file.size > (backup ? 768 : 50) * 1024 * 1024)
      throw new Error(
        `Choose a JSON file smaller than ${backup ? 768 : 50} MB.`,
      );
    const raw: unknown = JSON.parse(await file.text());
    if (backup) setRestore(parseBackup(raw));
    else await importData(raw, file.name);
  };
  const exportBackup = (filename: string) =>
    void run(async () => {
      setMessage("Preparing a portable backup, including original PDF images…");
      downloadJson(await portableBackup(data!), filename);
      setMessage(
        "Portable backup exported, including PDF question and explanation images.",
      );
    });
  const start = async (ids: string[]) => {
    if (!ids.length) return;
    await run(async () => {
      let id = "";
      await mutate((d) => {
        id = beginSession(d, ids, filters).id;
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
  const ongoing = data.sessions.findLast((s) => !s.finishedAt);
  const current = data.sessions.find((s) => s.id === sessionId);
  const stats = summarize(data);
  const misses = filterQuestions(data, {
    ...defaultFilters,
    status: "incorrect",
  }).length;
  const changeFilters = (value: FilterValues) => {
    setFilters(value);
    setVisible(40);
  };
  return (
    <>
      <header className="app-header">
        <button className="brand" onClick={() => setPage("library")}>
          <span className="brand-icon">S</span>
          <span>
            SAT <b>Study</b>
          </span>
        </button>
        <nav aria-label="Main navigation">
          {[
            ["library", "Question library"],
            ["review", "Review & progress"],
            ["data", "My data"],
          ].map(([id, label]) => (
            <button
              className={page === id ? "active" : ""}
              key={id}
              onClick={() => {
                setPage(id);
                setMessage("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="local-indicator">
          <i />{" "}
          {error
            ? "Save needs attention"
            : saving
              ? "Saving locally…"
              : "Local workspace"}
        </span>
      </header>
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
          onBack={() => setPage("library")}
          onRetry={(ids) => void start(ids)}
        />
      ) : page === "library" ? (
        <main className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR DAILY PRACTICE</p>
              <h1>Make room for a little progress.</h1>
              <p className="muted">
                Choose a focus. Take your time. Learn from every answer.
              </p>
            </div>
            <button onClick={() => setPage("data")}>＋ Import questions</button>
          </div>
          {ongoing && (
            <div className="resume-strip">
              <div>
                <strong>Your session is waiting.</strong>
                <span>
                  {" "}
                  {ongoing.questionIds.length} questions · started{" "}
                  {new Date(ongoing.startedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => {
                  setSessionId(ongoing.id);
                  setPage("practice");
                }}
              >
                Resume practice →
              </button>
            </div>
          )}
          {!data.questions.length ? (
            <section className="empty-state">
              <div className="empty-symbol">¶</div>
              <h2>Your study space starts here.</h2>
              <p>
                Load 12 original sample questions to try the full workflow,
                <br />
                or import your own structured question file.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(() => importData(synthetic, "synthetic.json"))
                }
              >
                Load synthetic sample
              </button>
              <p className="small muted">
                Original examples only. No College Board question content is
                bundled.
              </p>
            </section>
          ) : (
            <>
              <section className="filter-panel">
                <div className="section-heading">
                  <h2>Find your focus</h2>
                  <button
                    className="text-button"
                    onClick={() => changeFilters({ ...defaultFilters })}
                  >
                    Reset filters
                  </button>
                </div>
                <Filters data={data} value={filters} onChange={changeFilters} />
                <div className="filter-bottom">
                  <label className="search">
                    <span className="sr-only">Search questions</span>
                    <input
                      placeholder="Search questions, skills, or source IDs…"
                      value={filters.search}
                      onChange={(e) =>
                        changeFilters({ ...filters, search: e.target.value })
                      }
                    />
                  </label>
                  <span className="small muted">
                    Unknown status is included when active questions are hidden.
                  </span>
                </div>
              </section>
              <div className="library-toolbar">
                <div>
                  <h2>
                    Question library{" "}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <p className="small muted">
                    {filters.active === "hide"
                      ? "Active practice-test questions are hidden."
                      : filters.active === "include" ||
                          filters.active === "only"
                        ? "Active questions can appear in these results."
                        : "Practice-test status filter applied."}
                  </p>
                </div>
                <div className="session-controls">
                  <label>
                    Session size
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                    >
                      {[5, 10, 20, 0].map((n) => (
                        <option value={n} key={n}>
                          {n || "All"} questions
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary"
                    disabled={!filtered.length || busy}
                    onClick={() =>
                      void start(
                        filtered
                          .slice(0, limit || filtered.length)
                          .map((q) => q.id),
                      )
                    }
                  >
                    Start practice →
                  </button>
                </div>
              </div>
              {ongoing && (
                <p className="small muted">
                  Starting a new session ends the current session and keeps all
                  submitted answers and notes.
                </p>
              )}
              <div className="question-list">
                {filtered.slice(0, visible).map((q, index) => {
                  const a = latestAttempt(data, q.id);
                  const marked = data.annotations[q.id]?.bookmarked;
                  return (
                    <button
                      className="question-row"
                      key={q.id}
                      onClick={() => void start([q.id])}
                    >
                      <span className="row-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="row-body">
                        <span className="row-meta">
                          {sectionName(q.section)}
                          <span> / </span>
                          {q.domain || "Domain unspecified"}
                        </span>
                        <span className="row-title">{q.stem}</span>
                        <span className="small muted">
                          {q.skill || "Skill unspecified"}
                          {marked ? " · ★ Bookmarked" : ""}
                        </span>
                      </span>
                      <span className="row-tags">
                        <span
                          className={`status ${a ? (a.correct ? "correct" : "incorrect") : ""}`}
                        >
                          {a
                            ? a.correct
                              ? "Correct"
                              : "Incorrect"
                            : "Unanswered"}
                        </span>
                        <span className="small muted">
                          {q.difficulty || "Unspecified"} · {q.testStatus}
                        </span>
                      </span>
                      <span className="row-arrow">↗</span>
                    </button>
                  );
                })}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <h2>No questions match yet.</h2>
                  <p>
                    Try broadening your filters or importing more questions.
                  </p>
                  <button onClick={() => changeFilters({ ...defaultFilters })}>
                    Reset filters
                  </button>
                </div>
              )}
              {filtered.length > visible && (
                <button
                  className="load-more"
                  onClick={() => setVisible(visible + 40)}
                >
                  Show more questions
                </button>
              )}
            </>
          )}
        </main>
      ) : page === "review" ? (
        <main className="page narrow">
          <p className="eyebrow">REFLECT & RETURN</p>
          <h1>Turn mistakes into understanding.</h1>
          <p className="muted">
            A small record of the work you’ve done. Every submitted attempt
            counts.
          </p>
          <div className="stats">
            <div>
              <strong>{stats.total}</strong>
              <span>answers submitted</span>
            </div>
            <div>
              <strong>{stats.total ? `${stats.accuracy}%` : "—"}</strong>
              <span>accuracy across attempts</span>
            </div>
            <div>
              <strong>{stats.total ? `${stats.averageSeconds}s` : "—"}</strong>
              <span>average answer time</span>
            </div>
          </div>
          <section className="review-card">
            <h2>Return to your mistakes</h2>
            <p>
              {misses} questions have an incorrect latest answer, with active
              questions hidden.
            </p>
            <button
              className="primary"
              disabled={!misses}
              onClick={() => {
                setFilters({ ...defaultFilters, status: "incorrect" });
                setPage("library");
              }}
            >
              Review mistakes →
            </button>
            <button
              className="text-button"
              onClick={() => {
                setFilters({ ...defaultFilters, status: "ever-missed" });
                setPage("library");
              }}
            >
              See everything ever missed
            </button>
          </section>
          <h2>Skills to revisit</h2>
          {!stats.weaknesses.length ? (
            <p className="muted">
              Missed answers will help you find a focus here.
            </p>
          ) : (
            <div className="skill-list">
              {stats.weaknesses.map((s) => (
                <button
                  key={s.skill}
                  onClick={() => {
                    setFilters({
                      ...defaultFilters,
                      skill: s.skill === "Unspecified skill" ? "" : s.skill,
                      status: "ever-missed",
                    });
                    setPage("library");
                  }}
                >
                  <span>{s.skill}</span>
                  <span>
                    {s.missed} missed / {s.total} attempts →
                  </span>
                </button>
              ))}
            </div>
          )}
          <h2 className="spaced">Recent sessions</h2>
          {data.sessions.length === 0 ? (
            <p className="muted">Your practice sessions will appear here.</p>
          ) : (
            data.sessions
              .slice()
              .reverse()
              .slice(0, 10)
              .map((s) => (
                <button
                  className="session-row"
                  key={s.id}
                  onClick={() => {
                    setSessionId(s.id);
                    setPage("practice");
                  }}
                >
                  <span>
                    {new Date(s.startedAt).toLocaleString()} ·{" "}
                    {s.questionIds.length} questions
                  </span>
                  <span>{s.finishedAt ? "View results" : "Resume"} →</span>
                </button>
              ))
          )}
        </main>
      ) : (
        <main className="page narrow">
          <p className="eyebrow">A LIBRARY THAT STAYS WITH YOU</p>
          <h1>Your questions. Your laptop.</h1>
          <p className="muted">
            Question content and study history stay in this browser. No account,
            uploads, or cloud sync.
          </p>
          <div className="data-grid">
            <section className="data-card">
              <h2>Import a question set</h2>
              <p>
                Choose normalized JSON in the documented schema. Imports are
                validated before saving; existing source IDs are skipped.
              </p>
              <label className={`file-button ${busy ? "disabled" : ""}`}>
                Choose question JSON
                <input
                  aria-label="Import question JSON"
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
                Prepared PDF libraries are loaded automatically from this
                laptop. Keep original exports and private library files outside
                Git.
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void run(() => importData(synthetic, "synthetic.json"))
                }
              >
                Load synthetic sample
              </button>
              <button
                className="text-button"
                onClick={() =>
                  downloadJson(synthetic, "synthetic-questions.json")
                }
              >
                Download example JSON
              </button>
            </section>
            <section className="data-card">
              <h2>Back up your work</h2>
              <p>
                Export questions, answers, notes, bookmarks, and sessions
                together. Keep backups somewhere you control.
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
                    void run(() => readFile(file, true));
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
                {restore.questions.length} questions, {restore.attempts.length}{" "}
                attempts, {restore.sessions.length} sessions. This replaces the
                current library and history.
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
                    });
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
        </main>
      )}
      <footer className="app-footer">
        <span>Made for focused, independent study.</span>
        <span>Personal practice · Not affiliated with College Board</span>
      </footer>
    </>
  );
}
