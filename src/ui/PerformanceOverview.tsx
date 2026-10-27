import { useMemo, useState, type CSSProperties } from "react";
import type { Section, StudyData } from "../core/model";
import {
  performanceOverview,
  type AttemptPerformance,
  type DomainPerformance,
} from "../core/review";

type Scope =
  | { kind: "all" }
  | { kind: "section"; section: Section }
  | { kind: "domain"; key: string };

const sectionLabel = (section: Section) =>
  section === "math" ? "Math" : "Reading & Writing";
const attemptsLabel = (count: number) =>
  `${count} ${count === 1 ? "attempt" : "attempts"}`;

function AttemptMarks({ metric }: { metric: AttemptPerformance }) {
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
          ? `Twelve grouped marks summarize ${attemptsLabel(metric.attempts)}.`
          : `${metric.correct} correct and ${metric.incorrect} incorrect.`
      }
      aria-label={
        aggregated
          ? `${metric.correct} correct and ${metric.incorrect} incorrect across ${attemptsLabel(metric.attempts)}; marks are grouped.`
          : `${metric.correct} correct and ${metric.incorrect} incorrect across ${attemptsLabel(metric.attempts)}.`
      }
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
  const value = metric.accuracy ?? 0;
  return (
    <div className="performance-gauge" aria-live="polite">
      <p className="gauge-label">{label}</p>
      <div
        className="gauge-visual"
        role="img"
        aria-label={
          metric.accuracy === undefined
            ? `${label}: not attempted, 0 attempts`
            : `${label}: ${metric.accuracy}% accuracy across ${attemptsLabel(metric.attempts)}`
        }
      >
        <svg viewBox="0 0 200 108" aria-hidden="true">
          <path className="gauge-track" d="M18 100 A82 82 0 0 1 182 100" />
          {metric.accuracy !== undefined && value > 0 && (
            <path
              className="gauge-value"
              d="M18 100 A82 82 0 0 1 182 100"
              pathLength="100"
              strokeDasharray={`${value} ${100 - value}`}
            />
          )}
        </svg>
        <div className="gauge-reading">
          <strong>
            {metric.accuracy === undefined ? "Not attempted" : `${value}%`}
          </strong>
          <span>{attemptsLabel(metric.attempts)}</span>
        </div>
      </div>
      {metric.attempts > 0 && (
        <p className="gauge-counts">
          {metric.correct} correct · {metric.incorrect} incorrect
        </p>
      )}
      {metric.attempts > 0 && metric.attempts < 5 && (
        <p className="small muted gauge-caution">Limited data so far.</p>
      )}
    </div>
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
  const mistakes = domain.questionIds.filter((id) => mistakeIds.has(id));
  const eligible = domain.questionIds.filter((id) => eligibleIds.has(id));
  return (
    <details className={`domain-row ${selected ? "selected" : ""}`}>
      <summary onClick={onSelect}>
        <span className="domain-name">{domain.domain}</span>
        <span className="domain-metric">
          {domain.accuracy === undefined
            ? "Not attempted"
            : `${domain.accuracy}%`}
          <small>{attemptsLabel(domain.attempts)}</small>
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
                    ? "Not attempted"
                    : `${skill.accuracy}%`}{" "}
                  · {attemptsLabel(skill.attempts)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">
            No skills from this domain are available in the local question
            library.
          </p>
        )}
        <div className="domain-actions">
          {mistakes.length > 0 && (
            <button
              aria-label={`Review mistakes in ${domain.domain}`}
              onClick={() => onStart(mistakes, "mistakes")}
            >
              Review mistakes
            </button>
          )}
          <button
            aria-label={`Practice ${domain.domain}`}
            disabled={!eligible.length}
            onClick={() => onStart(eligible)}
          >
            Practice this domain
          </button>
        </div>
      </div>
    </details>
  );
}

export function PerformanceOverview({
  data,
  protectTests,
  mistakeIds,
  onStart,
}: {
  data: StudyData;
  protectTests: boolean;
  mistakeIds: string[];
  onStart: (ids: string[], source?: "mistakes") => void;
}) {
  const performance = useMemo(() => performanceOverview(data), [data]);
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const selectedDomain =
    scope.kind === "domain"
      ? performance.domains.find((domain) => domain.key === scope.key)
      : undefined;
  const metric =
    scope.kind === "all"
      ? performance.all
      : scope.kind === "section"
        ? performance.sections[scope.section]
        : selectedDomain || performance.all;
  const label =
    scope.kind === "all"
      ? "All SAT practice"
      : scope.kind === "section"
        ? sectionLabel(scope.section)
        : selectedDomain?.domain || "All SAT practice";
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
          <p className="eyebrow">PERFORMANCE SO FAR</p>
          <h2 id="performance-heading">Explore your answered work</h2>
        </div>
        <div
          className="performance-scope"
          role="group"
          aria-label="Performance scope"
        >
          <button
            aria-pressed={scope.kind === "all"}
            onClick={() => setScope({ kind: "all" })}
          >
            All
          </button>
          {(["math", "reading-writing"] as const).map((section) => (
            <button
              key={section}
              aria-pressed={
                scope.kind === "section" && scope.section === section
              }
              onClick={() => setScope({ kind: "section", section })}
            >
              {sectionLabel(section)}
            </button>
          ))}
        </div>
      </div>
      <Gauge metric={metric} label={label} />
      <div className="domain-groups">
        {(["math", "reading-writing"] as const).map((section) => (
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
                      setScope({ kind: "domain", key: domain.key })
                    }
                    onStart={onStart}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
      <p className="small muted performance-note">
        Accuracy is correct submitted attempts divided by all submitted attempts
        in the selected scope. Unanswered questions are not counted; repeated
        attempts remain separate.
      </p>
    </section>
  );
}
