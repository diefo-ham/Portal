import type { AssessmentInfo } from "../../core/assessments";
import type { Assessment } from "../../core/model";
import { Help } from "../Help";
import { useT } from "../i18n";
import type { Page } from "@/src/types/ui";

export type AppHeaderProps = {
  info: AssessmentInfo;
  /** Every test, in the order the switch lists them. */
  assessments: readonly AssessmentInfo[];
  page: Page;
  /** A Practice Test or timed test is open, so "Tests" stays highlighted. */
  testOpen: boolean;
  onHome: () => void;
  onNavigate: (page: Page) => void;
  onSwitchAssessment: (next: Assessment) => void;
};

/** The brand, the test switch (SAT, PAA, TSI), the main navigation, Help and Settings. */
export const AppHeader = ({
  info,
  assessments,
  page,
  testOpen,
  onHome,
  onNavigate,
  onSwitchAssessment,
}: AppHeaderProps) => {
  const t = useT();
  // One stroke style for every icon; they are decoration beside a text label.
  const icons: Partial<Record<Page, string>> = {
    home: "M4 16V5l6-2 6 2v11M8 16v-5h4v5",
    review: "M4 10a6 6 0 1 0 2-4.5M4 3v3h3M10 7v3l2 2",
    library: "M4 5h12M4 10h12M4 15h8",
    tests: "M6 3h8v14H6zM8.5 7h3M8.5 10h3",
    data: "M4 6h7M15 6h1M4 14h1M9 14h7M13 4a2 2 0 1 0 0 4a2 2 0 1 0 0-4M7 12a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  };
  const icon = (id: Page) => (
    <svg className="nav-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d={icons[id]} />
    </svg>
  );
  const links: [Page, string][] = [
    ["home", "Practice"],
    ["review", "Review"],
    ["library", "Browse"],
  ];
  // The SAT has module-style Practice Tests; the PAA has a timed test mode.
  if (info.practiceTests) links.push(["tests", "Tests"]);
  else if (info.testMode) links.push(["tests", "Test mode"]);
  else if (info.fixedTests) links.push(["tests", "Tests"]);
  return (
    <header className="app-header">
      <button className="brand" onClick={onHome}>
        <span className="brand-icon">{info.name[0]}</span>
        <span>
          {info.name} <b>Study</b>
        </span>
      </button>
      <div
        className="assessment-switch"
        role="group"
        aria-label={t("Choose a test")}
      >
        {assessments.map((test) => (
          <button
            key={test.id}
            className={test.id === info.id ? "active" : ""}
            aria-pressed={test.id === info.id}
            aria-label={
              test.id === info.id
                ? t("Test: {name}", { name: test.name })
                : t("Switch to {other}", { other: test.name })
            }
            title={
              test.id === info.id
                ? undefined
                : t("Switch to {other}", { other: test.name })
            }
            onClick={() => test.id !== info.id && onSwitchAssessment(test.id)}
          >
            {test.name}
          </button>
        ))}
      </div>
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
              {icon(id)}
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
          {icon("data")}
          <span className="settings-label" aria-hidden="true">
            {t("Settings")}
          </span>
        </button>
      </nav>
    </header>
  );
};
