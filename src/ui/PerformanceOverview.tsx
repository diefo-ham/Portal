import { useMemo, useState, type CSSProperties } from "react";
import { assessmentInfo, sectionLabel } from "../core/assessments";
import type { Section, StudyData } from "../core/model";
import { useAssessment, useT, type Translate } from "./i18n";
import {
  performanceOverview,
  type AttemptPerformance,
  type DomainPerformance,
} from "../core/review";
import { PerformanceGauge } from "./PerformanceGauge";

type Scope = { kind: "all" } | { kind: "section"; section: Section };

const attemptsLabel = (t: Translate, count: number) =>
  t(count === 1 ? "{n} attempt" : "{n} attempts", { n: count });

function AttemptMarks({ metric }: { metric: AttemptPerformance }) {
  const t = useT();
  if (!metric.attempts) return null;
  const limit = 12;
  const groups = Array.from(
    { length: Math.min(metric.outcomes.length, limit) },
    (_, index) => {
      const start = Math.floor((index * metric.outcomes.length) / limit);
      const end = Math.floor(((index + 1) * metric.outcomes.length) / limit);
      const outcomes =
        metric.outcomes.length <= limit
          ? [metric.outcomes[index]]
          : metric.outcomes.slice(start, Math.max(start + 1, end));
      return outcomes.filter(Boolean).length / outcomes.length;
    },
  );
  const aggregated = metric.outcomes.length > limit;
  return (
    <span
      className="attempt-marks"
      role="img"
      title={
        aggregated
          ? t("Twelve grouped marks summarize {attempts}.", {
              attempts: attemptsLabel(t, metric.attempts),
            })
          : t("{correct} correct and {incorrect} incorrect.", {
              correct: metric.correct,
              incorrect: metric.incorrect,
            })
      }
      aria-label={t(
        aggregated
          ? "{correct} correct and {incorrect} incorrect across {attempts}; marks are grouped."
          : "{correct} correct and {incorrect} incorrect across {attempts}.",
        {
          correct: metric.correct,
          incorrect: metric.incorrect,
          attempts: attemptsLabel(t, metric.attempts),
        },
      )}
    >
      {groups.map((share, index) => (
        <span
          aria-hidden="true"
          className={
            share === 1 ? "correct" : share === 0 ? "incorrect" : "mixed"
          }
          style={
            share > 0 && share < 1
              ? ({ "--correct-share": `${share * 100}%` } as CSSProperties)
              : undefined
          }
          key={index}
        />
      ))}
    </span>
  );
}

function Gauge({
  metric,
  label,
}: {
  metric: AttemptPerformance;
  label: string;
}) {
  const t = useT();
  const value = metric.accuracy ?? 0;
  return (
    <PerformanceGauge
      value={metric.accuracy === undefined ? undefined : value}
      label={label}
      detail={
        metric.accuracy === undefined
          ? undefined
          : attemptsLabel(t, metric.attempts)
      }
      ariaLabel={
        metric.accuracy === undefined
          ? t("{label}: not attempted, 0 attempts", { label })
          : t("{label}: {accuracy}% accuracy across {attempts}", {
              label,
              accuracy: metric.accuracy,
              attempts: attemptsLabel(t, metric.attempts),
            })
      }
      footer={
        <>
          {metric.attempts > 0 && (
            <p className="gauge-counts">
              {t("{correct} correct · {incorrect} incorrect", {
                correct: metric.correct,
                incorrect: metric.incorrect,
              })}
            </p>
          )}
          {metric.attempts > 0 && metric.attempts < 5 && (
            <p className="small muted gauge-caution">
              {t("Limited data so far.")}
            </p>
          )}
        </>
      }
    />
  );
}

function DomainRow({
  domain,
  selected,
  eligibleIds,
  mistakeIds,
  onSelect,
  onStart,
}: {
  domain: DomainPerformance;
  selected: boolean;
  eligibleIds: Set<string>;
  mistakeIds: Set<string>;
  onSelect: () => void;
  onStart: (ids: string[], source?: "mistakes") => void;
}) {
  const t = useT();
  const mistakes = domain.questionIds.filter((id) => mistakeIds.has(id));
  const eligible = domain.questionIds.filter((id) => eligibleIds.has(id));
  return (
    <details
      className={`domain-row ${selected ? "selected" : ""}`}
      open={selected}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          onSelect();
        }}
      >
        <span className="domain-name">{domain.domain}</span>
        <span className="domain-metric">
          {domain.accuracy === undefined ? (
            t("No attempts")
          ) : (
            <>
              {domain.accuracy}%
              <small>{attemptsLabel(t, domain.attempts)}</small>
            </>
          )}
        </span>
        <AttemptMarks metric={domain} />
      </summary>
      <div className="domain-detail">
        {domain.skills.length ? (
          <div className="skill-performance">
            {domain.skills.map((skill) => (
              <div key={skill.key}>
                <span>{skill.skill}</span>
                <span>
                  {skill.accuracy === undefined
                    ? t("No attempts")
                    : `${skill.accuracy}% · ${attemptsLabel(t, skill.attempts)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">
            {t(
              "No skills from this domain are available in the local question library.",
            )}
          </p>
        )}
        <div className="domain-actions">
          {mistakes.length > 0 && (
            <button
              aria-label={t("Review mistakes in {domain}", {
                domain: domain.domain,
              })}
              onClick={() => onStart(mistakes, "mistakes")}
            >
              {t("Review mistakes")}
            </button>
          )}
          <button
            aria-label={t("Practice {domain}", { domain: domain.domain })}
            disabled={!eligible.length}
            onClick={() => onStart(eligible)}
          >
            {t("Practice this domain")}
          </button>
        </div>
      </div>
    </details>
  );
}

export type PerformanceOverviewProps = {
  data: StudyData;
  protectTests: boolean;
  mistakeIds: string[];
  onStart: (ids: string[], source?: "mistakes") => void;
};

export const PerformanceOverview = ({
  data,
  protectTests,
  mistakeIds,
  onStart,
}: PerformanceOverviewProps) => {
  const t = useT();
  const info = assessmentInfo(useAssessment());
  const performance = useMemo(
    () => performanceOverview(data, info.id),
    [data, info.id],
  );
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [expandedDomainKey, setExpandedDomainKey] = useState<string>();
  const selectedDomain = performance.domains.find(
    (domain) => domain.key === expandedDomainKey,
  );
  const scopeMetric =
    scope.kind === "all"
      ? performance.all
      : performance.sections[scope.section];
  const metric = selectedDomain || scopeMetric;
  const scopeLabel =
    scope.kind === "all"
      ? t("All {name} practice", { name: info.name })
      : sectionLabel(scope.section);
  const label = selectedDomain?.domain || scopeLabel;
  const mistakes = useMemo(() => new Set(mistakeIds), [mistakeIds]);
  const eligibleIds = useMemo(
    () =>
      new Set(
        data.questions
          .filter(
            (question) => !protectTests || question.testStatus !== "active",
          )
          .map((question) => question.id),
      ),
    [data.questions, protectTests],
  );
  return (
    <section
      className="performance-overview"
      aria-labelledby="performance-heading"
    >
      <div className="performance-heading">
        <div>
          <p className="eyebrow">{t("PERFORMANCE SO FAR")}</p>
          <h2 id="performance-heading">{t("Explore your answered work")}</h2>
        </div>
        <div
          className="performance-scope"
          role="group"
          aria-label={t("Performance scope")}
        >
          <button
            aria-pressed={scope.kind === "all"}
            onClick={() => {
              setScope({ kind: "all" });
              setExpandedDomainKey(undefined);
            }}
          >
            {t("All")}
          </button>
          {info.performanceOrder.map((section) => (
            <button
              key={section}
              aria-pressed={
                scope.kind === "section" && scope.section === section
              }
              onClick={() => {
                setScope({ kind: "section", section });
                setExpandedDomainKey(undefined);
              }}
            >
              {sectionLabel(section)}
            </button>
          ))}
        </div>
      </div>
      <Gauge metric={metric} label={label} />
      <div className="domain-groups">
        {info.performanceOrder.map((section) => (
          <section key={section} aria-labelledby={`domains-${section}`}>
            <h3 id={`domains-${section}`}>{sectionLabel(section)}</h3>
            <div>
              {performance.domains
                .filter((domain) => domain.section === section)
                .map((domain) => (
                  <DomainRow
                    key={domain.key}
                    domain={domain}
                    selected={selectedDomain?.key === domain.key}
                    eligibleIds={eligibleIds}
                    mistakeIds={mistakes}
                    onSelect={() =>
                      setExpandedDomainKey((current) =>
                        current === domain.key ? undefined : domain.key,
                      )
                    }
                    onStart={onStart}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
      <p className="small muted performance-note">
        {t(
          "Accuracy is correct submitted attempts divided by all submitted attempts in the selected scope. Unanswered questions are not counted; repeated attempts remain separate.",
        )}
      </p>
      {info.id === "TSI" && (
        <p className="small muted performance-note">
          {t(
            "This is the share of answers you got right in practice. It is not a TSI score: the real TSIA2 adapts to each student and College Board publishes no conversion, so this portal shows no score and no pass or fail.",
          )}
        </p>
      )}
      {info.id === "PAA" && (
        <p className="small muted performance-note">
          {t(
            "This is the share of answers you got right in practice. It is not a PAA score: the real score is converted from the full test.",
          )}
        </p>
      )}
    </section>
  );
};
