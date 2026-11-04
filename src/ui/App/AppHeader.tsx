import type { AssessmentInfo } from "../../core/assessments";
import type { Assessment } from "../../core/model";
import { Help } from "../Help";
import { useT } from "../i18n";

export type AppHeaderProps = {
  info: AssessmentInfo;
  /** The other test, which the toggle switches to. */
  other: AssessmentInfo;
  page: string;
  /** A Practice Test or timed test is open, so "Tests" stays highlighted. */
  testOpen: boolean;
  onHome: () => void;
  onNavigate: (page: string) => void;
  onSwitchAssessment: (next: Assessment) => void;
};

/** The brand, the SAT/PAA switch, the main navigation, Help and Settings. */
export const AppHeader = ({
  info,
  other,
  page,
  testOpen,
  onHome,
  onNavigate,
  onSwitchAssessment,
}: AppHeaderProps) => {
  const t = useT();
  const links = [
    ["home", "Practice"],
    ["review", "Review"],
    ["library", "Browse"],
    ...(info.practiceTests
      ? [["tests", "Tests"]]
      : info.testMode
        ? [["tests", "Test mode"]]
        : []),
  ];
  return (
    <header className="app-header">
      <button className="brand" onClick={onHome}>
        <span className="brand-icon">{info.name[0]}</span>
        <span>
          {info.name} <b>Study</b>
        </span>
      </button>
      <button
        className="assessment-toggle"
        aria-label={t("Test: {name}. Switch to {other}", {
          name: info.name,
          other: other.name,
        })}
        title={t("Switch to {other}", { other: other.name })}
        onClick={() => onSwitchAssessment(other.id)}
      >
        {info.name} ⇄
      </button>
      <nav aria-label={t("Main navigation")}>
        {links.map(([id, label]) => {
          const current =
            page === id || (id === "tests" && page === "practice" && testOpen);
          return (
            <button
              className={current ? "active" : ""}
              aria-current={current ? "page" : undefined}
              key={id}
              onClick={() => onNavigate(id)}
            >
              {t(label)}
            </button>
          );
        })}
        <Help />
        <button
          className={`settings-link ${page === "data" ? "active" : ""}`}
          aria-current={page === "data" ? "page" : undefined}
          aria-label={t("Settings")}
          title={t("Settings")}
          onClick={() => onNavigate("data")}
        >
          ⚙
        </button>
      </nav>
    </header>
  );
};
