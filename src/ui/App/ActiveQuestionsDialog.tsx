import { useId } from "react";

export type ActiveQuestionsDialogProps = {
  busy: boolean;
  onCancel: () => void;
  onBegin: () => void;
};

/** Warns before a session that includes active practice-test questions. */
export const ActiveQuestionsDialog = ({
  busy,
  onCancel,
  onBegin,
}: ActiveQuestionsDialogProps) => {
  const headingId = useId();
  return (
    <div className="portal-modal-backdrop" role="presentation">
      <section
        className="portal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <p className="eyebrow">ACTIVE PRACTICE-TEST QUESTIONS</p>
        <h2 id={headingId}>Practice these questions again?</h2>
        <p>
          This session includes active practice-test questions and may spoil a
          future Bluebook test.
        </p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy} onClick={onBegin}>
            Begin anyway
          </button>
        </div>
      </section>
    </div>
  );
};
