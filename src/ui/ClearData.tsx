import { useEffect, useRef, useState } from "react";
import { storageUsage } from "../storage/localData";
import { useT } from "./i18n";

type Action = "questions" | "everything";

const size = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

export type ClearDataProps = {
  busy: boolean;
  hasQuestions: boolean;
  onRemoveQuestions: () => Promise<void>;
  onEraseEverything: () => Promise<void>;
};

export const ClearData = ({
  busy,
  hasQuestions,
  onRemoveQuestions,
  onEraseEverything,
}: ClearDataProps) => {
  const t = useT();
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
      <h2>{t("Free up space")}</h2>
      <p>
        {usage !== undefined
          ? t("This site is using about {size} on this device.", {
              size: size(usage),
            }) + " "
          : ""}
        {t("The question images take most of it.")}
      </p>
      <div className="row">
        <button
          className="text-button danger"
          disabled={busy || !hasQuestions}
          onClick={() => ask("questions")}
        >
          {t("Remove my questions")}
        </button>
        <button
          className="text-button danger"
          disabled={busy}
          onClick={() => ask("everything")}
        >
          {t("Erase all data on this device")}
        </button>
      </div>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="clear-data-title"
      >
        <h2 id="clear-data-title">
          {everything
            ? t("Erase all data on this device?")
            : t("Remove your questions?")}
        </h2>
        {everything ? (
          <>
            <p>
              {t(
                "This deletes your questions, answers, sessions, bookmarks and settings from this browser, and the saved offline copy of the app. It cannot be undone.",
              )}
            </p>
            <p className="small muted">
              {t(
                "Your original PDFs are not touched, so you can add them again.",
              )}
            </p>
          </>
        ) : (
          <>
            <p>
              {t(
                "This deletes the questions and their images from this browser and ends your saved sessions. Your answers and bookmarks are kept and apply again when you add the same PDFs.",
              )}
            </p>
            <p className="small muted">
              {t("Your original PDFs are not touched.")}
            </p>
          </>
        )}
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            {t("Cancel")}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              void (everything ? onEraseEverything() : onRemoveQuestions());
            }}
          >
            {everything ? t("Erase everything") : t("Remove questions")}
          </button>
        </div>
      </dialog>
    </section>
  );
};
