import { useRef, useState } from "react";
import { useT } from "./i18n";

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
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [clearBookmarks, setClearBookmarks] = useState(false);
  const [recovering, setRecovering] = useState(false);
  return (
    <section className="reset-maintenance">
      <h2>{t("Reset study progress")}</h2>
      <p>
        {t(
          "Clear your answers and sessions to start fresh. You can keep your bookmarks. This also restores Practice Test question eligibility.",
        )}
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
        {t("Reset study progress")}
      </button>
      {archiveDate && (
        <div className="reset-recovery">
          <p className="small muted">
            {t("One recovery archive · {date}", {
              date: new Date(archiveDate).toLocaleString(),
            })}
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
            {t("Restore previous study state")}
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
            ? t("Restore previous study state?")
            : t("Reset study progress?")}
        </h2>
        {recovering ? (
          <p>
            {t(
              "This replaces your current answers, sessions, drafts, recorded time, and bookmarks with the state saved immediately before your last reset. Your question bank and preferences stay unchanged. Saved ordinary timers will be paused. Practice Test clocks retain their original start times and exposure history.",
            )}
          </p>
        ) : (
          <>
            <p>
              {t(
                "This clears all answers, completed and unfinished sessions, drafts, and recorded practice time. Your question bank and interface preferences will remain available.",
              )}
            </p>
            <p className="small muted">
              {t(
                "Your current study state, including all bookmarks, will be saved locally as one recovery archive. This replaces any previous reset archive.",
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={clearBookmarks}
                onChange={(e) => setClearBookmarks(e.target.checked)}
              />{" "}
              {t("Also clear bookmarks")}
            </label>
          </>
        )}
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            {t("Cancel")}
          </button>
          <button
            className={recovering ? "" : "danger"}
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void (recovering ? onRestore() : onConfirm(clearBookmarks));
            }}
          >
            {recovering ? t("Confirm restore") : t("Confirm reset")}
          </button>
        </div>
      </dialog>
    </section>
  );
}
