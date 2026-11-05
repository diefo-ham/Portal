import { useT } from "../i18n";

export type LeavePanelProps = {
  isTest: boolean;
  pending: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/** Confirms leaving; the work is already saved. */
export const LeavePanel = ({
  isTest,
  pending,
  onStay,
  onLeave,
}: LeavePanelProps) => {
  const t = useT();
  return (
    <div className="tool-menu">
      <p>
        {isTest
          ? "Your work is saved. Leaving pauses the module. Resume explicitly when you return."
          : t("Your work is saved. You can resume this session from Practice.")}
      </p>
      <button onClick={onStay}>{t("Cancel")}</button>
      <button className="primary" disabled={pending} onClick={onLeave}>
        {t("Leave session")}
      </button>
    </div>
  );
};
