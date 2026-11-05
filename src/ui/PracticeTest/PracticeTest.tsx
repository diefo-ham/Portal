import { useEffect, useState } from "react";
import type { Session, StudyData, TestSelection } from "../../core/model";
import { renameSession } from "../../core/commands";
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
  sectionLabel,
  testAnswerIsValid,
  timerWarning,
} from "../../core/practiceTest";
import { Practice } from "../Practice/Practice";
import { time } from "../formatTime";
import { ConfirmTestDialog } from "./ConfirmTestDialog";
import { HowPracticeTestsWork } from "./HowPracticeTestsWork";
import { PracticeTestOptions, type Timing } from "./PracticeTestOptions";
import { RenameTestDialog } from "./RenameTestDialog";
import { TestList } from "./TestList";
import { useBusy } from "@/src/helpers/useBusy";
import type { Mutate, RetryKind } from "@/src/types/ui";
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
  const [timing, setTiming] = useState<Timing>("timed");
  const [busy, run] = useBusy();
  const [renameTarget, setRenameTarget] = useState<Session>();
  const [cancelTarget, setCancelTarget] = useState<Session>();
  const [deleteTarget, setDeleteTarget] = useState<Session>();
  const error = availability(data, selection);
  const tests = data.sessions
    .filter((s) => s.practiceTest)
    .slice()
    .reverse();
  const start = () =>
    run(async () => {
      try {
        let id = "";
        await mutate((d) => {
          id = beginPracticeTest(d, selection, timing).id;
        });
        onOpen(id);
      } catch {
        /* global error */
      }
    });
  const saveRename = (name: string) =>
    run(async () => {
      if (!renameTarget) return;
      await mutate((draft) => renameSession(draft, renameTarget.id, name));
      setRenameTarget(undefined);
    });
  const confirmCancel = () =>
    run(async () => {
      if (!cancelTarget) return;
      await mutate((draft) => cancelPracticeTest(draft, cancelTarget.id));
      setCancelTarget(undefined);
    });
  const confirmDelete = () =>
    run(async () => {
      if (!deleteTarget) return;
      await mutate((draft) =>
        deleteCompletedPracticeTest(draft, deleteTarget.id),
      );
      setDeleteTarget(undefined);
    });
  return (
    <main className="page narrow practice-test-setup">
      <p className="eyebrow">PRACTICE TEST</p>
      <h1>A test, at your pace.</h1>
      <p className="muted">
        Use unused active questions for a full adaptive test or one module.
        These questions may also appear in a future Bluebook test.
      </p>
      <PracticeTestOptions
        selection={selection}
        timing={timing}
        error={error}
        busy={busy}
        onSelection={setSelection}
        onTiming={setTiming}
        onStart={() => void start()}
        onSettings={onSettings}
      />
      <HowPracticeTestsWork />
      <TestList
        title="Your Practice Tests"
        tests={tests}
        meta={(s) => s.practiceTest!.timing}
        openLabel={(s) => (s.finishedAt ? "View results" : "Resume test")}
        actionsLabel={(s) => `Practice Test actions for ${s.name}`}
        menuItems={(s) => [
          { label: "Rename", onSelect: () => setRenameTarget(s) },
          s.finishedAt
            ? {
                label: "Delete test",
                danger: true,
                onSelect: () => setDeleteTarget(s),
              }
            : {
                label: "Cancel test",
                danger: true,
                onSelect: () => setCancelTarget(s),
              },
        ]}
        onOpen={onOpen}
      />
      {renameTarget && (
        <RenameTestDialog
          initialName={renameTarget.name || "Practice Test"}
          eyebrow="PRACTICE TEST"
          heading="Rename Practice Test"
          fieldLabel="Test name"
          cancelLabel="Cancel"
          saveLabel="Save name"
          busy={busy}
          onSave={(name) => void saveRename(name)}
          onCancel={() => setRenameTarget(undefined)}
        />
      )}
      {cancelTarget && (
        <ConfirmTestDialog
          eyebrow="CANCEL PRACTICE TEST"
          heading="Abandon this Practice Test?"
          cancelLabel="Keep test"
          confirmLabel="Cancel Practice Test"
          busy={busy}
          onConfirm={() => void confirmCancel()}
          onCancel={() => setCancelTarget(undefined)}
        >
          <p>
            The resumable attempt will be removed without results or an SAT
            estimate. Questions already shown will remain used for Practice
            Tests.
          </p>
        </ConfirmTestDialog>
      )}
      {deleteTarget && (
        <ConfirmTestDialog
          eyebrow="DELETE PRACTICE TEST"
          heading="Delete this completed test?"
          cancelLabel="Keep test"
          confirmLabel="Delete test"
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(undefined)}
        >
          <p>
            Delete “{deleteTarget.name}” and its results? Questions exposed by
            this test will remain used and ineligible for future Practice Tests.
          </p>
          <p className="small muted">
            Bookmarks, settings, and other Practice or Practice Test history
            will not be changed.
          </p>
        </ConfirmTestDialog>
      )}
    </main>
  );
};
export type PracticeTestRunProps = {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
  onRetry: (ids: string[], kind: RetryKind) => void;
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
