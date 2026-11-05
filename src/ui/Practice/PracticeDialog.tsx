import type { ReactNode, Ref, SyntheticEvent } from "react";
import { useT } from "../i18n";

export type PracticeDialogProps = {
  dialogRef: Ref<HTMLDialogElement>;
  title: string;
  /** Offer a Back button to Practice tools. */
  showBack: boolean;
  onBack: () => void;
  /** The × button or a click on the backdrop. */
  onDismiss: () => void;
  /** Escape. The caller may prevent the default to keep the dialog open. */
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  /** The dialog has closed, however that happened. */
  onClosed: () => void;
  children: ReactNode;
};

/** The modal that holds the Practice panels, with its heading and close button. */
export const PracticeDialog = ({
  dialogRef,
  title,
  showBack,
  onBack,
  onDismiss,
  onCancel,
  onClosed,
  children,
}: PracticeDialogProps) => {
  const t = useT();
  return (
    <dialog
      ref={dialogRef}
      className="practice-dialog"
      onCancel={onCancel}
      onKeyDown={(event) => {
        // A held Escape must not also close the dialog behind this one.
        if (event.key === "Escape" && event.repeat) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      onClose={onClosed}
    >
      <div className="dialog-heading">
        {showBack && (
          <button
            className="dialog-back"
            aria-label={t("Back to Practice tools")}
            onClick={onBack}
          >
            ← <span>{t("Back")}</span>
          </button>
        )}
        <h2>{title}</h2>
        <button aria-label={t("Close panel")} onClick={onDismiss}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
};
