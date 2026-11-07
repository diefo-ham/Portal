import { useMemo, useState } from "react";
import { deleteSession, renameSession } from "../../core/commands";
import {
  isTsiTestSession,
  type StudyData,
  type TsiSubject,
  type TsiTestKind,
  type TsiTestSession,
} from "../../core/model";
import { sessionOutcomes } from "../../core/review";
import {
  beginTsiTest,
  buildTsiTest,
  kindName,
  plannedTotal,
  subjectName,
  tsiTestAvailability,
  tsiTestSlots,
  TSI_KINDS,
  TSI_SUBJECTS,
} from "../../core/tsiTest";
import { ConfirmTestDialog } from "../PracticeTest/ConfirmTestDialog";
import { RenameTestDialog } from "../PracticeTest/RenameTestDialog";
import { TestList } from "../PracticeTest/TestList";
import type { Mutate } from "@/src/types/ui";

export type TsiTestsProps = {
  /** The TSI view of the data: hidden questions are not in it, so no test uses them. */
  data: StudyData;
  mutate: Mutate;
  onOpen: (id: string) => void;
  removesAnswers: boolean;
  timerDefault: boolean;
  onAddQuestions?: () => void;
};

const questionsLabel = (n: number) =>
  `${n} ${n === 1 ? "question" : "questions"}`;

/**
 * The TSI Tests tab: choose ELAR or Mathematics and the College Readiness test or
 * the Diagnostic, see what the real test is made of and what the bank can supply,
 * and start. The tests themselves are taken on the Practice screen.
 */
export const TsiTests = ({
  data,
  mutate,
  onOpen,
  removesAnswers,
  timerDefault,
  onAddQuestions,
}: TsiTestsProps) => {
  const [subject, setSubject] = useState<TsiSubject>("elar");
  const [kind, setKind] = useState<TsiTestKind>("crc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renameTarget, setRenameTarget] = useState<TsiTestSession>();
  const [deleteTarget, setDeleteTarget] = useState<TsiTestSession>();
  const availability = useMemo(
    () => tsiTestAvailability(data, kind, subject),
    [data, kind, subject],
  );
  const realTotal = plannedTotal(tsiTestSlots(kind, subject));
  // How many questions a test would have now (sets can differ in size).
  const wouldHave = useMemo(
    () => buildTsiTest(data, kind, subject).questionIds.length,
    [data, kind, subject],
  );
  const tests = data.sessions.filter(isTsiTestSession).toReversed();
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
  const start = () =>
    run(async () => {
      const { questionIds, shortfall } = buildTsiTest(data, kind, subject);
      let id = "";
      await mutate((d) => {
        id = beginTsiTest(
          d,
          kind,
          subject,
          questionIds,
          shortfall,
          timerDefault,
        ).id;
      });
      onOpen(id);
    });
  const meta = (session: TsiTestSession) => {
    if (!session.finishedAt) return "in progress";
    const result = sessionOutcomes(data, session);
    const total = session.questionIds.length;
    return `${result.correct.length} of ${total} correct (${total ? Math.round((100 * result.correct.length) / total) : 0}%)`;
  };
  const choose = <T extends string>(
    label: string,
    options: readonly { id: T; text: string }[],
    value: T,
    set: (next: T) => void,
  ) => (
    <div className="section-filter wide">
      <span className="filter-label">{label}</span>
      <div className="section-segments" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            aria-pressed={value === option.id}
            onClick={() => set(option.id)}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <main className="page narrow test-mode-page tsi-tests-page">
      <p className="eyebrow">PRACTICE TESTS</p>
      <h1>TSIA2 practice tests</h1>
      <p className="muted">
        Each test is made of the same parts as the real TSIA2, in the same
        numbers. You answer in order, with no going back and no answers shown
        until the end, and there is no clock.
      </p>
      {!data.questions.length ? (
        <section className="empty-state">
          <h2>Add your questions to begin.</h2>
          <p>Add your question PDFs; they are prepared on this device.</p>
          {onAddQuestions && (
            <button className="primary" onClick={onAddQuestions}>
              Add your question PDFs
            </button>
          )}
        </section>
      ) : (
        <section className="practice-composer" aria-label="New test">
          <div className="section-heading">
            <h2>Choose a test</h2>
          </div>
          <div className="filters">
            {choose(
              "Subject",
              TSI_SUBJECTS.map((id) => ({ id, text: subjectName(id) })),
              subject,
              setSubject,
            )}
            {choose(
              "Test",
              TSI_KINDS.map((id) => ({
                id,
                text: `${kindName(id)} · ${plannedTotal(tsiTestSlots(id, subject))} questions`,
              })),
              kind,
              setKind,
            )}
          </div>
          <table className="part-plan">
            <caption className="sr-only">What this test is made of</caption>
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col">Real test</th>
                <th scope="col">In your bank</th>
              </tr>
            </thead>
            <tbody>
              {availability.slots.map(({ slot, have }) => (
                <tr key={slot.id}>
                  <th scope="row">{slot.label}</th>
                  <td>
                    {slot.unit === "set"
                      ? `${slot.need} ${slot.need === 1 ? "set" : "sets"} of 4`
                      : slot.need}
                  </td>
                  <td className={have < slot.need ? "short" : undefined}>
                    {slot.unit === "set"
                      ? `${have} ${have === 1 ? "set" : "sets"}`
                      : have}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>{questionsLabel(wouldHave)}</strong>
            {wouldHave !== realTotal && ` (the real test has ${realTotal})`}
          </p>
          {availability.short && (
            <p className="small muted">
              Your bank has fewer questions than the real test uses for some
              parts, so this test will be shorter. Adding more questions, or
              turning on Include original questions in Settings, brings it
              closer. Questions you have answered least are used first.
            </p>
          )}
          <div className="test-rules small muted">
            <p>
              <strong>As on the real test:</strong> you answer in order and
              cannot go back; the answers appear only at the end; there is no
              time limit. Exit saves your place, and you can continue later. A
              Math question has the calculator its tag names (Basic, Square root
              or Graphing); the real test is adaptive, but this one keeps the
              real content balance instead of routing by difficulty.
            </p>
          </div>
          <button
            className="primary"
            disabled={busy || !availability.possible}
            onClick={() => void start()}
          >
            Start the test →
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
      )}
      <TestList
        title="Your tests"
        tests={tests}
        meta={meta}
        openLabel={(s) => (s.finishedAt ? "View results" : "Continue")}
        actionsLabel={(s) => `Actions for ${s.name}`}
        menuItems={(s) => [
          { label: "Rename", onSelect: () => setRenameTarget(s) },
          {
            label: s.finishedAt ? "Delete test" : "Cancel test",
            danger: true,
            onSelect: () => setDeleteTarget(s),
          },
        ]}
        onOpen={onOpen}
      />
      {renameTarget && (
        <RenameTestDialog
          initialName={renameTarget.name || "Practice test"}
          eyebrow="PRACTICE TESTS"
          heading="Rename the test"
          fieldLabel="Test name"
          cancelLabel="Cancel"
          saveLabel="Save name"
          busy={busy}
          onSave={(name) =>
            void run(async () => {
              await mutate((d) => renameSession(d, renameTarget.id, name));
              setRenameTarget(undefined);
            })
          }
          onCancel={() => setRenameTarget(undefined)}
        />
      )}
      {deleteTarget && (
        <ConfirmTestDialog
          eyebrow={deleteTarget.finishedAt ? "DELETE TEST" : "CANCEL TEST"}
          heading={
            deleteTarget.finishedAt ? "Delete this test?" : "Cancel this test?"
          }
          cancelLabel="Keep the test"
          confirmLabel={deleteTarget.finishedAt ? "Delete test" : "Cancel test"}
          busy={busy}
          onConfirm={() =>
            void run(async () => {
              await mutate((d) =>
                deleteSession(d, deleteTarget.id, removesAnswers),
              );
              setDeleteTarget(undefined);
            })
          }
          onCancel={() => setDeleteTarget(undefined)}
        >
          <p>
            {deleteTarget.finishedAt
              ? `“${deleteTarget.name}” and its results are deleted. `
              : `“${deleteTarget.name}” is removed without results. `}
            {removesAnswers
              ? "Its answers are also removed from your progress, and those questions become unanswered again."
              : "Your answers stay in your study history."}
          </p>
        </ConfirmTestDialog>
      )}
    </main>
  );
};
