import { useEffect, useRef, useState } from "react";
import { storageUsage } from "../storage/localData";

type Action = "questions" | "everything";

const size = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

export function ClearData({
  busy,
  hasQuestions,
  onRemoveQuestions,
  onEraseEverything,
}: {
  busy: boolean;
  hasQuestions: boolean;
  onRemoveQuestions: () => Promise<void>;
  onEraseEverything: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [action, setAction] = useState<Action>("questions");
  const [usage, setUsage] = useState<number>();
  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [busy, hasQuestions]);
  const ask = (next: Action) => {
    setAction(next);
    dialog.current?.showModal();
    cancel.current?.focus();
  };
  const everything = action === "everything";
  return (
    <section className="reset-maintenance clear-data">
      <h2>Free up space</h2>
      <p>
        {usage !== undefined
          ? `This site is using about ${size(usage)} on this device. `
          : ""}
        The question images take most of it.
      </p>
      <div className="row">
        <button
          className="text-button danger"
          disabled={busy || !hasQuestions}
          onClick={() => ask("questions")}
        >
          Remove my questions
        </button>
        <button
          className="text-button danger"
          disabled={busy}
          onClick={() => ask("everything")}
        >
          Erase all data on this device
        </button>
      </div>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="clear-data-title"
      >
        <h2 id="clear-data-title">
          {everything
            ? "Erase all data on this device?"
            : "Remove your questions?"}
        </h2>
        {everything ? (
          <>
            <p>
              This deletes your questions, answers, sessions, bookmarks and
              settings from this browser, and the saved offline copy of the app.
              It cannot be undone.
            </p>
            <p className="small muted">
              Your original PDFs are not touched, so you can add them again.
            </p>
          </>
        ) : (
          <>
            <p>
              This deletes the questions and their images from this browser and
              ends your saved sessions. Your answers and bookmarks are kept and
              apply again when you add the same PDFs.
            </p>
            <p className="small muted">Your original PDFs are not touched.</p>
          </>
        )}
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void (everything ? onEraseEverything() : onRemoveQuestions());
            }}
          >
            {everything ? "Erase everything" : "Remove questions"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
