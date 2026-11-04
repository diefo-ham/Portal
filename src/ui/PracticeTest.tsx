import { useEffect, useRef, useState } from "react";
import type { Session, StudyData, TestSelection } from "../core/model";
import { renameSession } from "../core/commands";
import { SESSION_NAME_MAX_LENGTH } from "../core/sessions";
import {
  availability,
  beginPracticeTest,
  cancelPracticeTest,
  completeTestModule,
  continueAfterBreak,
  deleteCompletedPracticeTest,
  pausePracticeTest,
  resumePracticeTest,
  moduleElapsed,
  moduleLimit,
  selections,
  sectionLabel,
  testAnswerIsValid,
  timerWarning,
} from "../core/practiceTest";
import { Practice, time } from "./Practice";
type Mutate = (fn: (data: StudyData) => void) => Promise<StudyData>;
export type PracticeTestSetupProps = {
  data: StudyData;
  mutate: Mutate;
  onOpen: (id: string) => void;
  onSettings: () => void;
};

export const PracticeTestSetup = ({
  data,
  mutate,
  onOpen,
  onSettings,
}: PracticeTestSetupProps) => {
  const [selection, setSelection] = useState<TestSelection>("full");
  const [timing, setTiming] = useState<"timed" | "untimed">("timed");
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [renameTarget, setRenameTarget] = useState<Session>();
  const [cancelTarget, setCancelTarget] = useState<Session>();
  const [deleteTarget, setDeleteTarget] = useState<Session>();
  const [name, setName] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const error = availability(data, selection);
  const tests = data.sessions
    .filter((s) => s.practiceTest)
    .slice()
    .reverse();
  useEffect(() => {
    if (renameTarget) nameInput.current?.select();
  }, [renameTarget]);
  const openRename = (session: Session) => {
    setMenuId("");
    setName(session.name || "Practice Test");
    setRenameTarget(session);
  };
  const saveRename = async () => {
    if (!renameTarget) return;
    setBusy(true);
    try {
      await mutate((draft) => renameSession(draft, renameTarget.id, name));
      setRenameTarget(undefined);
    } finally {
      setBusy(false);
    }
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await mutate((draft) => cancelPracticeTest(draft, cancelTarget.id));
      setCancelTarget(undefined);
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await mutate((draft) =>
        deleteCompletedPracticeTest(draft, deleteTarget.id),
      );
      setDeleteTarget(undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page narrow practice-test-setup">
      <p className="eyebrow">PRACTICE TEST</p>
      <h1>A test, at your pace.</h1>
      <p className="muted">
        Use unused active questions for a full adaptive test or one module.
        These questions may also appear in a future Bluebook test.
      </p>
      <section className="utility test-setup-fields">
        <label>
          Test selection
          <select
            value={selection}
            onChange={(e) => setSelection(e.target.value as TestSelection)}
          >
            {selections.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Timing
          <select
            value={timing}
            onChange={(e) => setTiming(e.target.value as typeof timing)}
          >
            <option value="timed">Timed</option>
            <option value="untimed">Untimed</option>
          </select>
        </label>
        <p className="small muted">
          {selection === "full"
            ? "98 questions · four modules · optional 10-minute break."
            : `${selection.startsWith("math") ? 22 : 27} questions · one module.`}{" "}
          {timing === "timed"
            ? "32 minutes per Reading and Writing module; 35 minutes per Math module."
            : "Elapsed time only. No deadline or automatic module end."}{" "}
          Leaving an active module pauses its clock until you explicitly resume.
        </p>
        {error && (
          <p role="status">
            {error}{" "}
            <button className="text-button" onClick={onSettings}>
              Open reset settings
            </button>
          </p>
        )}
        <button
          className="primary"
          disabled={!!error || busy}
          onClick={async () => {
            setBusy(true);
            try {
              let id = "";
              await mutate((d) => {
                id = beginPracticeTest(d, selection, timing).id;
              });
              onOpen(id);
            } catch {
              /* global error */
            } finally {
              setBusy(false);
            }
          }}
        >
          Start Practice Test
        </button>
      </section>
      <details className="utility">
        <summary>How Practice Tests work</summary>
        <p>
          A Full Test moves through Reading and Writing Modules 1 and 2, an
          optional break, then Math Modules 1 and 2. You can move freely inside
          a module. Finishing it locks its answers.
        </p>
        <p>
          Module 2 adapts to scored Module 1 performance using a transparent
          approximation. Individual modules use the difficulty route you select.
        </p>
        <p>
          Exactly two randomly chosen questions per module are simulated as
          unscored. Their identities stay hidden during the test. Results show
          scored accuracy and an unofficial estimated SAT range, using available
          difficulty and route metadata.
        </p>
        <p>
          Questions included in a module stay used for Practice Tests, even if
          you leave or delete the attempt. Overall study-progress reset in
          Settings restores eligibility.
        </p>
      </details>
      {tests.length > 0 && (
        <section className="utility practice-test-list-section">
          <h2>Your Practice Tests</h2>
          <div className="practice-test-list" role="list">
            {tests.map((s) => (
              <div className="practice-test-row" role="listitem" key={s.id}>
                <div className="practice-test-row-copy">
                  <span className="practice-test-row-name">{s.name}</span>
                  <span className="practice-test-row-meta">
                    {new Date(s.startedAt).toLocaleDateString()} ·{" "}
                    {s.practiceTest!.timing}
                  </span>
                </div>
                <div className="practice-test-row-actions">
                  <button onClick={() => onOpen(s.id)}>
                    {s.finishedAt ? "View results" : "Resume test"}
                  </button>
                  <div className="session-action-wrap">
                    <button
                      className="session-menu-trigger"
                      aria-label={`Practice Test actions for ${s.name}`}
                      aria-expanded={menuId === s.id}
                      onClick={() => setMenuId(menuId === s.id ? "" : s.id)}
                    >
                      •••
                    </button>
                    {menuId === s.id && (
                      <div className="session-menu" role="menu">
                        <button role="menuitem" onClick={() => openRename(s)}>
                          Rename
                        </button>
                        {!s.finishedAt && (
                          <button
                            className="danger"
                            role="menuitem"
                            onClick={() => {
                              setMenuId("");
                              setCancelTarget(s);
                            }}
                          >
                            Cancel test
                          </button>
                        )}
                        {s.finishedAt && (
                          <button
                            className="danger"
                            role="menuitem"
                            onClick={() => {
                              setMenuId("");
                              setDeleteTarget(s);
                            }}
                          >
                            Delete test
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {renameTarget && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-test-heading"
          >
            <p className="eyebrow">PRACTICE TEST</p>
            <h2 id="rename-test-heading">Rename Practice Test</h2>
            <label>
              Test name
              <input
                ref={nameInput}
                value={name}
                maxLength={SESSION_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveRename();
                }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setRenameTarget(undefined)}>Cancel</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void saveRename()}
              >
                Save name
              </button>
            </div>
          </section>
        </div>
      )}
      {cancelTarget && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-test-heading"
          >
            <p className="eyebrow">CANCEL PRACTICE TEST</p>
            <h2 id="cancel-test-heading">Abandon this Practice Test?</h2>
            <p>
              The resumable attempt will be removed without results or an SAT
              estimate. Questions already shown will remain used for Practice
              Tests.
            </p>
            <div className="modal-actions">
              <button onClick={() => setCancelTarget(undefined)}>
                Keep test
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void confirmCancel()}
              >
                Cancel Practice Test
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div className="portal-modal-backdrop" role="presentation">
          <section
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-test-heading"
          >
            <p className="eyebrow">DELETE PRACTICE TEST</p>
            <h2 id="delete-test-heading">Delete this completed test?</h2>
            <p>
              Delete “{deleteTarget.name}” and its results? Questions exposed by
              this test will remain used and ineligible for future Practice
              Tests.
            </p>
            <p className="small muted">
              Bookmarks, settings, and other Practice or Practice Test history
              will not be changed.
            </p>
            <div className="modal-actions">
              <button onClick={() => setDeleteTarget(undefined)}>
                Keep test
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                Delete test
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
export type PracticeTestRunProps = {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
};

export const PracticeTestRun = ({
  data,
  session,
  mutate,
  onBack,
  onRetry,
}: PracticeTestRunProps) => {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const test = session.practiceTest!;
  const module = test.modules[test.currentModule];
  const elapsed = moduleElapsed(module, now, test.timing === "timed");
  const remaining = Math.max(0, moduleLimit(module.section) - elapsed);
  const expired =
    test.phase === "module" &&
    test.timing === "timed" &&
    !session.paused &&
    remaining === 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!expired) return;
    const index = test.currentModule;
    void mutate((d) => {
      const current = d.sessions.find(
        (candidate) => candidate.id === session.id,
      )!;
      if (
        current.practiceTest?.currentModule === index &&
        current.practiceTest.phase === "module" &&
        !current.paused
      )
        completeTestModule(d, session.id);
    }).catch(() => {});
  }, [expired, test.currentModule, session.id, mutate]);

  const leave = () =>
    mutate((d) => pausePracticeTest(d, session.id)).then(() => onBack());
  const pause = () => mutate((d) => pausePracticeTest(d, session.id));
  const resume = () => mutate((d) => resumePracticeTest(d, session.id));
  const cancel = () =>
    mutate((d) => cancelPracticeTest(d, session.id)).then(() => onBack());
  const openOverview = () =>
    mutate((d) => {
      const current = d.sessions.find(
        (candidate) => candidate.id === session.id,
      )!;
      if (current.practiceTest?.phase === "module" && !current.paused)
        current.practiceTest.reviewingModule = true;
    });
  const openQuestion = (questionId: string) =>
    mutate((d) => {
      const current = d.sessions.find(
        (candidate) => candidate.id === session.id,
      )!;
      if (!current.practiceTest || current.paused) return;
      current.index = current.questionIds.indexOf(questionId);
      current.practiceTest.reviewingModule = false;
    });
  const next = async () => {
    setBusy(true);
    try {
      await mutate((d) => continueAfterBreak(d, session.id));
    } finally {
      setBusy(false);
    }
  };

  if (test.phase === "results")
    return (
      <Practice
        data={data}
        session={session}
        mutate={mutate}
        showCorrectExplanations={false}
        onBack={onBack}
        onRetry={onRetry}
      />
    );

  if (test.phase === "break") {
    const breakRemaining = Math.max(
      0,
      600_000 - (now - (test.breakStartedAt ?? now)),
    );
    return (
      <main className="page narrow test-break">
        <button className="text-button" onClick={onBack}>
          ← Exit
        </button>
        <p className="eyebrow">PRACTICE TEST</p>
        <h1>A moment to pause.</h1>
        <p>Reading and Writing is complete. Math is next.</p>
        <p className="break-timer" aria-label="Break remaining">
          {time(breakRemaining)}
        </p>
        <p className="muted">
          {breakRemaining
            ? "Take the full break, or continue whenever you are ready."
            : "Your break is complete. Math is ready when you are."}
        </p>
        <button className="primary" disabled={busy} onClick={() => void next()}>
          {breakRemaining ? "Skip break and start Math" : "Start Math"}
        </button>
      </main>
    );
  }

  const moduleQuestions = module.questionIds.map((id) =>
    data.questions.find((question) => question.id === id)!,
  );
  const marked = new Set(test.markedForReview || []);
  const isAnswered = (id: string) =>
    testAnswerIsValid(
      data.questions.find((question) => question.id === id)!,
      session.drafts[id],
    );
  const unanswered = module.questionIds.filter((id) => !isAnswered(id)).length;
  const clock = {
    label:
      test.timing === "timed" ? "Module time remaining" : "Module elapsed time",
    ms: test.timing === "timed" ? remaining : elapsed,
    warning: test.timing === "timed" && timerWarning(remaining),
  };

  if (test.reviewingModule)
    return (
      <main className="page test-overview-page">
        <div className="practice-toolbar test-overview-toolbar">
          <button className="text-button" onClick={leave}>
            ← Exit
          </button>
          <p className="test-module-name">
            {sectionLabel(module.section)} · Module{" "}
            {module.mix === "first" ? 1 : 2}
          </p>
          <div className="toolbar-right">
            <span
              className={`timer test-timer ${clock.warning ? "timer-warning" : ""}`}
              aria-label={clock.label}
            >
              {time(clock.ms)}
            </span>
            <button
              disabled={busy || session.paused}
              onClick={() => void pause()}
            >
              Pause
            </button>
          </div>
        </div>
        <section className="test-overview-content">
          <p className="eyebrow">CHECK YOUR WORK</p>
          <h1>Question Overview</h1>
          <p className="muted">
            Review any question before finishing. Answered and marked states are
            shown independently.
          </p>
          <div className="overview-legend" aria-label="Question status legend">
            <span>
              <i className="status-dot answered" /> Answered
            </span>
            <span>
              <i className="status-dot unanswered" /> Unanswered
            </span>
            <span>
              <i className="status-flag">⚑</i> Marked for Review
            </span>
          </div>
          <div className="test-question-grid">
            {moduleQuestions.map((question, index) => {
              const answered = isAnswered(question.id);
              const review = marked.has(question.id);
              const status = `${answered ? "answered" : "unanswered"}${review ? ", marked for review" : ""}`;
              return (
                <button
                  key={question.id}
                  className={`${answered ? "answered" : "unanswered"} ${review ? "marked" : ""}`}
                  disabled={busy || session.paused}
                  aria-label={`Go to question ${index + 1}, ${status}`}
                  onClick={() => void openQuestion(question.id)}
                >
                  <strong aria-hidden="true">{index + 1}</strong>
                  <span>{answered ? "Answered" : "Unanswered"}</span>
                  {review && <span className="marked-label">⚑ Marked</span>}
                </button>
              );
            })}
          </div>
          <div className="overview-finish">
            <p>
              {unanswered
                ? `${unanswered} unanswered`
                : "All questions answered"}
            </p>
            <button
              className="primary"
              disabled={busy || session.paused}
              onClick={() => setConfirming(true)}
            >
              Finish Module
            </button>
          </div>
        </section>
        {confirming && !session.paused && (
          <div className="portal-modal-backdrop" role="presentation">
            <section
              className="portal-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="finish-module-heading"
            >
              <p className="eyebrow">FINISH MODULE</p>
              <h2 id="finish-module-heading">
                Finish {sectionLabel(module.section)} — Module{" "}
                {module.mix === "first" ? 1 : 2}?
              </h2>
              {unanswered > 0 && (
                <p>
                  {unanswered}{" "}
                  {unanswered === 1 ? "question is" : "questions are"}{" "}
                  unanswered.
                </p>
              )}
              <p className="muted">
                You cannot return to this module after finishing it.
              </p>
              <div className="modal-actions">
                <button onClick={() => setConfirming(false)}>Cancel</button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void mutate((d) =>
                      completeTestModule(d, session.id),
                    ).finally(() => {
                      setBusy(false);
                      setConfirming(false);
                    });
                  }}
                >
                  Finish module
                </button>
              </div>
            </section>
          </div>
        )}
        {session.paused && (
          <div
            className="test-paused-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paused-overview-heading"
          >
            <section className="test-paused-card">
              <p className="eyebrow">PRACTICE TEST PAUSED</p>
              <h1 id="paused-overview-heading">Your time is frozen.</h1>
              <p className="muted">
                Question navigation and finishing stay unavailable until you
                resume.
              </p>
              <button className="primary" onClick={() => void resume()}>
                Resume test
              </button>
              <button className="text-button" onClick={onBack}>
                Exit test
              </button>
            </section>
          </div>
        )}
      </main>
    );

  return (
    <Practice
      key={`${session.id}:${test.currentModule}`}
      data={data}
      session={session}
      mutate={mutate}
      showCorrectExplanations={false}
      onBack={leave}
      onRetry={onRetry}
      testClock={clock}
      onPauseTest={pause}
      onResumeTest={resume}
      onFinishModule={openOverview}
      onCancelTest={cancel}
    />
  );
};
