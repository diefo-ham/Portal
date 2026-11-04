import { useEffect, useId, useRef, useState } from "react";
import { SESSION_NAME_MAX_LENGTH } from "../../core/sessions";

export type RenameTestDialogProps = {
  initialName: string;
  eyebrow: string;
  heading: string;
  fieldLabel: string;
  cancelLabel: string;
  saveLabel: string;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
};

/** A modal that asks for a new name. Enter saves; the field starts selected. */
export const RenameTestDialog = ({
  initialName,
  eyebrow,
  heading,
  fieldLabel,
  cancelLabel,
  saveLabel,
  busy,
  onSave,
  onCancel,
}: RenameTestDialogProps) => {
  const [name, setName] = useState(initialName);
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  useEffect(() => input.current?.select(), []);
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
        <label>
          {fieldLabel}
          <input
            ref={input}
            value={name}
            maxLength={SESSION_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSave(name);
            }}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onCancel}>{cancelLabel}</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onSave(name)}
          >
            {saveLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
