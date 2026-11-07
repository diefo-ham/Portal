import { ShortcutHelp } from "../Help";
import { useT } from "../i18n";

export type ToolsPanelProps = {
  isTest: boolean;
  /** A TSI practice test: no overview (no going back), and finishing ends the test. */
  sequential?: boolean;
  showTime: boolean;
  paused: boolean;
  pending: boolean;
  /** Present when this Practice Test can be cancelled from here. */
  onCancelTest?: () => void;
  onOverview: () => void;
  onDetails: () => void;
  onShowTime: (visible: boolean) => void;
  onTogglePause: () => void;
  onFinish: () => void;
};

/** Shortcuts, the overview, the timer, details, and finishing or cancelling. */
export const ToolsPanel = ({
  isTest,
  sequential = false,
  showTime,
  paused,
  pending,
  onCancelTest,
  onOverview,
  onDetails,
  onShowTime,
  onTogglePause,
  onFinish,
}: ToolsPanelProps) => {
  const t = useT();
  return (
    <div className="tool-menu">
      <details>
        <summary>{t("Keyboard shortcuts & help")}</summary>
        <ShortcutHelp />
      </details>
      {!sequential && (
        <button onClick={onOverview}>{t("Question overview")}</button>
      )}
      {!isTest && (
        <label>
          <input
            type="checkbox"
            checked={showTime}
            onChange={(e) => onShowTime(e.target.checked)}
          />{" "}
          {t("Show timer")}
        </label>
      )}
      {!isTest && (
        <button onClick={onTogglePause}>
          {paused ? t("Resume timer") : t("Pause timer")}
        </button>
      )}
      <button onClick={onDetails}>{t("Question details")}</button>
      {isTest && onCancelTest && (
        <button className="danger" onClick={onCancelTest}>
          Cancel Practice Test
        </button>
      )}
      {!isTest && (
        <button onClick={onFinish} disabled={pending}>
          {sequential ? t("Finish test now") : t("Finish session")}
        </button>
      )}
    </div>
  );
};
