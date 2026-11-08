import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n";

export type UpdateDialogProps = {
  /** Switches to the waiting version; the page reloads once it has taken over. */
  onUpdate: () => void;
};

/**
 * Shown as soon as a newer version of the portal has been downloaded, and it
 * cannot be dismissed: the only way on is to update. Updating re-checks the
 * stored PDFs against the access codes the new version accepts (see
 * `core/accessCodes.ts`), so a replaced code takes effect for everyone.
 */
export const UpdateDialog = ({ onUpdate }: UpdateDialogProps) => {
  const t = useT();
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="update-dialog"
      aria-labelledby={headingId}
      // Escape does not close it, and a browser that closes it anyway gets it back.
      onCancel={(event) => event.preventDefault()}
      onClose={() => {
        if (!dialog.current?.open) dialog.current?.showModal();
      }}
    >
      <section className="test-paused-card">
        <p className="eyebrow">{t("UPDATE")}</p>
        <h1 id={headingId}>{t("A new version of the portal is ready.")}</h1>
        <p className="muted">
          {t(
            "Updating checks your PDFs against the current access codes. Questions from a PDF without a valid code are removed; your answers and bookmarks stay.",
          )}
        </p>
        <button
          className="primary"
          onClick={() => {
            setUpdating(true);
            onUpdate();
          }}
        >
          {updating ? t("Updating…") : t("Update now")}
        </button>
      </section>
    </dialog>
  );
};
