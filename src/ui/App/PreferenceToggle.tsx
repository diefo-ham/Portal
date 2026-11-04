import type { ReactNode } from "react";

export type PreferenceToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** The explanation under the checkbox. */
  hint: ReactNode;
};

/** A labelled checkbox with a short explanation underneath. */
export const PreferenceToggle = ({
  checked,
  onChange,
  label,
  hint,
}: PreferenceToggleProps) => (
  <>
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />{" "}
      {label}
    </label>
    <p className="small muted">{hint}</p>
  </>
);
