import { useId, type ReactNode } from "react";

export type ConfirmTestDialogProps = {
  eyebrow: string;
  heading: string;
  /** The explanation: usually one or two paragraphs. */
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A modal that confirms a destructive action, with a red confirm button. */
export const ConfirmTestDialog = ({
  eyebrow,
  heading,
  children,
  cancelLabel,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmTestDialogProps) => {
  const headingId = useId();
  return (
    <div className="portal-modal-backdrop" role="presentation">
      <section
        className="portal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={headingId}>{heading}</h2>
        {children}
        <div className="modal-actions">
          <button onClick={onCancel}>{cancelLabel}</button>
          <button className="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
