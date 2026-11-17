import { useRef, useState } from "react";
import { useT } from "./i18n";

export type ResetProgressProps = {
  busy: boolean;
  onConfirm: (clearBookmarks: boolean) => Promise<void>;
};

/** Clears answers and sessions after a confirmation. A reset cannot be undone. */
export const ResetProgress = ({ busy, onConfirm }: ResetProgressProps) => {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [clearBookmarks, setClearBookmarks] = useState(false);
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
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        {t("Reset study progress")}
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">{t("Reset study progress?")}</h2>
        <p>
          {t(
            "This clears all answers, completed and unfinished sessions, drafts, and recorded practice time. Your question bank and interface preferences will remain available.",
          )}
        </p>
        <p className="small muted">{t("A reset cannot be undone.")}</p>
        <label>
          <input
            type="checkbox"
            checked={clearBookmarks}
            onChange={(e) => setClearBookmarks(e.target.checked)}
          />{" "}
          {t("Also clear bookmarks")}
        </label>
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            {t("Cancel")}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void onConfirm(clearBookmarks);
            }}
          >
            {t("Confirm reset")}
          </button>
        </div>
      </dialog>
    </section>
  );
};
