import { useT } from "../i18n";

export type PracticeToolbarProps = {
  index: number;
  total: number;
  /** Absent when the timer is hidden. */
  timer?: {
    text: string;
    label: string;
    /** A Practice Test clock rather than time on this question. */
    test: boolean;
    warning: boolean;
  };
  /** Present during a Practice Test, which can be paused. */
  pause?: { disabled: boolean; onPause: () => void };
  /** Present for Math questions. */
  calculator?: {
    open: boolean;
    expanded: boolean;
    disabled: boolean;
    onToggle: () => void;
  };
  onExit: () => void;
  onOverview: () => void;
  onTools: () => void;
};

/** Exit, the question count, and the timer, pause, calculator and tools. */
export const PracticeToolbar = ({
  index,
  total,
  timer,
  pause,
  calculator,
  onExit,
  onOverview,
  onTools,
}: PracticeToolbarProps) => {
  const t = useT();
  return (
    <div className="practice-toolbar">
      <button className="text-button" onClick={onExit}>
        {t("← Exit")}
      </button>
      <button
        className="text-button"
        onClick={onOverview}
        aria-label={t("Open question overview")}
      >
        {t("Question {n}", { n: index + 1 })}{" "}
        <span className="muted">{t("of {total}", { total })}</span>
      </button>
      <div className="toolbar-right">
        {timer && (
          <span
            className={`timer ${timer.test ? "test-timer" : ""} ${timer.warning ? "timer-warning" : ""}`}
            aria-label={timer.label}
          >
            {timer.text}
          </span>
        )}
        {pause && (
          <button
            className="pause-test"
            disabled={pause.disabled}
            onClick={pause.onPause}
          >
            Pause
          </button>
        )}
        {calculator && (
          <button
            disabled={calculator.disabled}
            aria-expanded={calculator.expanded}
            title={`${calculator.open ? "Close" : "Open"} Calculator · \\ toggles`}
            onClick={calculator.onToggle}
          >
            Calculator
          </button>
        )}
        <button aria-label={t("Practice tools")} onClick={onTools}>
          •••
        </button>
      </div>
    </div>
  );
};
