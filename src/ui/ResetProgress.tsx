import { useRef, useState } from "react";

export function ResetProgress({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (clearBookmarks: boolean) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [clearBookmarks, setClearBookmarks] = useState(false);
  return (
    <section className="data-card spaced">
      <h2>Reset study progress</h2>
      <p>
        Clear your answers and sessions to start fresh. You can keep your
        bookmarks.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setClearBookmarks(false);
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        Reset study progress
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Reset study progress?</h2>
        <p>
          This clears all answers, completed and unfinished sessions, drafts,
          and recorded practice time. Your question bank and interface
          preferences will remain available.
        </p>
        <label>
          <input
            type="checkbox"
            checked={clearBookmarks}
            onChange={(e) => setClearBookmarks(e.target.checked)}
          />{" "}
          Also clear bookmarks
        </label>
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void onConfirm(clearBookmarks);
            }}
          >
            Confirm reset
          </button>
        </div>
      </dialog>
    </section>
  );
}
