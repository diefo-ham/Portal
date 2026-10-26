import { useRef, useState } from "react";

export function ResetProgress({
  busy,
  onConfirm,
  archiveDate,
  onRestore,
}: {
  busy: boolean;
  onConfirm: (clearBookmarks: boolean) => Promise<void>;
  archiveDate?: string;
  onRestore: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [clearBookmarks, setClearBookmarks] = useState(false);
  const [recovering, setRecovering] = useState(false);
  return (
    <section className="reset-maintenance">
      <h2>Reset study progress</h2>
      <p>
        Clear your answers and sessions to start fresh. You can keep your
        bookmarks.
      </p>
      <button
        className="text-button danger"
        disabled={busy}
        onClick={() => {
          setClearBookmarks(false);
          setRecovering(false);
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        Reset study progress
      </button>
      {archiveDate && (
        <div className="reset-recovery">
          <p className="small muted">
            One recovery archive · {new Date(archiveDate).toLocaleString()}
          </p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRecovering(true);
              dialog.current?.showModal();
              cancel.current?.focus();
            }}
          >
            Restore previous study state
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">
          {recovering
            ? "Restore previous study state?"
            : "Reset study progress?"}
        </h2>
        {recovering ? (
          <p>
            This replaces your current answers, sessions, drafts, recorded time,
            and bookmarks with the state saved immediately before your last
            reset. Your question bank and preferences stay unchanged. Saved
            timers will be paused.
          </p>
        ) : (
          <>
            <p>
              This clears all answers, completed and unfinished sessions,
              drafts, and recorded practice time. Your question bank and
              interface preferences will remain available.
            </p>
            <p className="small muted">
              Your current study state, including all bookmarks, will be saved
              locally as one recovery archive. This replaces any previous reset
              archive.
            </p>
            <label>
              <input
                type="checkbox"
                checked={clearBookmarks}
                onChange={(e) => setClearBookmarks(e.target.checked)}
              />{" "}
              Also clear bookmarks
            </label>
          </>
        )}
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            className={recovering ? "" : "danger"}
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void (recovering ? onRestore() : onConfirm(clearBookmarks));
            }}
          >
            {recovering ? "Confirm restore" : "Confirm reset"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
