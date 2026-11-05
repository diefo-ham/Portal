import { useMemo, useState } from "react";
import type {
  Section,
  SatSection,
  Session,
  StudyData,
  TestModule,
} from "../core/model";
import { estimatedRange, scoredSummary } from "../core/practiceTest";
import { domainKey, skillKey } from "../core/taxonomy";
import { PerformanceGauge } from "./PerformanceGauge";
import { SessionResults } from "./SessionResults";
import { formatElapsed } from "./formatTime";
import type { Mutate, RetryKind } from "@/src/types/ui";

type ResultScope = "overall" | SatSection;
type ResultMode = "percentage" | "estimate";

export const formatPercentage = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};

export const resultSectionLabel = (section: SatSection) =>
  section === "math" ? "Math" : "Reading & Writing";

export const resultModuleLabel = (module: Pick<TestModule, "section" | "mix">) =>
  `${resultSectionLabel(module.section)} — ${
    module.mix === "first"
      ? "Module 1"
      : `Module 2, ${module.mix === "higher" ? "Higher" : "Lower"} Difficulty`
  }`;

export interface SkillResult {
  key: string;
  label: string;
  correct: number;
  attempted: number;
  scored: number;
}

export interface DomainResult extends SkillResult {
  section: Section;
  skills: SkillResult[];
}

function domainResults(data: StudyData, session: Session, modules: TestModule[]) {
  const unscored = new Set(modules.flatMap((module) => module.unscoredIds));
  return domainResultsOf(
    data,
    session,
    modules
      .flatMap((module) => module.questionIds)
      .filter((id) => !unscored.has(id)),
  );
}

/** Domains and skills of the given questions, with what this session answered. */
export function domainResultsOf(
  data: StudyData,
  session: Session,
  questionIds: string[],
): DomainResult[] {
  const attempts = new Map(
    data.attempts
      .filter((attempt) => attempt.sessionId === session.id)
      .map((attempt) => [attempt.questionId, attempt]),
  );
  const domains = new Map<
    string,
    Omit<DomainResult, "skills"> & { skills: Map<string, SkillResult> }
  >();
  for (const id of questionIds) {
    const question = data.questions.find((candidate) => candidate.id === id);
    if (!question) continue;
    const dKey = domainKey(question);
    const domain = domains.get(dKey) || {
      key: dKey,
      label: question.domain || "Unspecified domain",
      section: question.section,
      correct: 0,
      attempted: 0,
      scored: 0,
      skills: new Map<string, SkillResult>(),
    };
    const sKey = skillKey(question);
    const skill = domain.skills.get(sKey) || {
      key: sKey,
      label: question.skill || "Unspecified skill",
      correct: 0,
      attempted: 0,
      scored: 0,
    };
    const attempt = attempts.get(id);
    domain.scored++;
    skill.scored++;
    if (attempt) {
      domain.attempted++;
      skill.attempted++;
    }
    if (attempt?.correct) {
      domain.correct++;
      skill.correct++;
    }
    domain.skills.set(sKey, skill);
    domains.set(dKey, domain);
  }
  return [...domains.values()]
    .map((domain) => ({
      ...domain,
      skills: [...domain.skills.values()].sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    }))
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) || a.label.localeCompare(b.label),
    );
}

function ScoreEstimate({
  data,
  session,
  scope,
  percentage,
}: {
  data: StudyData;
  session: Session;
  scope: ResultScope;
  percentage: string;
}) {
  const allModules = session.practiceTest!.modules;
  const rw = estimatedRange(data, session, "reading-writing", allModules);
  const math = estimatedRange(data, session, "math", allModules);
  const total = rw && math ? ([rw[0] + math[0], rw[1] + math[1]] as const) : undefined;
  const primary = scope === "math" ? math : scope === "reading-writing" ? rw : total || rw || math;
  const denominator = scope === "overall" && total ? 1600 : 800;
  const primaryLabel =
    scope === "overall" && total
      ? "Estimated total"
      : `${scope === "overall" ? resultSectionLabel(allModules[0].section) : resultSectionLabel(scope)} estimate`;
  return (
    <div className="estimate-summary" aria-live="polite">
      <p className="estimate-label">{primaryLabel}</p>
      {primary ? (
        <p className="test-score">{primary.join("–")} <small>/ {denominator}</small></p>
      ) : (
        <p className="muted">A score range is not available for this scope.</p>
      )}
      {total && (
        <div className="estimate-sections">
          <span><strong>{rw!.join("–")}</strong> R&amp;W / 800</span>
          <span><strong>{math!.join("–")}</strong> Math / 800</span>
        </div>
      )}
      <p className="estimate-accuracy">Actual scored accuracy: <strong>{percentage}</strong></p>
      <p className="small muted estimate-note">
        Unofficial practice estimate, not official College Board scoring. It uses the existing difficulty-weighted heuristic and avoids claiming exact score precision.
      </p>
      <details className="estimate-method">
        <summary>How this estimate is calculated</summary>
        <p className="small muted">
          Easy, Medium (including unspecified), and Hard questions receive weights of 0.8, 1, and 1.2. A section starts at 200 plus 600 times weighted accuracy, with a small Module 2 route adjustment. The result is shown as a rounded range.
        </p>
      </details>
    </div>
  );
}

export type PracticeTestResultsProps = {
  data: StudyData;
  session: Session;
  mutate: Mutate;
  onBack: () => void;
  onRetry: (ids: string[], kind: RetryKind) => void;
};

export const PracticeTestResults = ({
  data,
  session,
  mutate,
  onBack,
  onRetry,
}: PracticeTestResultsProps) => {
  const [scope, setScope] = useState<ResultScope>("overall");
  const [mode, setMode] = useState<ResultMode>("percentage");
  const [openDomain, setOpenDomain] = useState<
    Partial<Record<SatSection, string>>
  >({});
  const modules = session.practiceTest!.modules;
  const availableSections = (["math", "reading-writing"] as const).filter((section) =>
    modules.some((module) => module.section === section),
  );
  const selected = useMemo(
    () =>
      scope === "overall"
        ? modules
        : modules.filter((module) => module.section === scope),
    [modules, scope],
  );
  const result = scoredSummary(data, session, selected);
  const percentage = formatPercentage(result.percentage);
  const domains = useMemo(
    () => domainResults(data, session, selected),
    [data, session, selected],
  );
  const rankedDomains = [...domains].sort(
    (a, b) =>
      b.correct / Math.max(1, b.scored) - a.correct / Math.max(1, a.scored),
  );
  const strongestDomain = rankedDomains[0];
  const weakestDomain = rankedDomains.at(-1);
  const domainGlanceLabel = (domain: DomainResult) =>
    `${scope === "overall" && availableSections.length > 1 ? `${resultSectionLabel(domain.section as SatSection)} · ` : ""}${domain.label}`;
  return (
    <SessionResults
      data={data}
      session={session}
      mutate={mutate}
      onBack={onBack}
      onRetry={onRetry}
      testSummary={
        <div className="practice-results-overview">
          <div className="results-title-row">
            <div>
              <h1>Practice Test results</h1>
              <p className="muted">A scored view of what happened, with detail when you want it.</p>
            </div>
            <div className="result-mode" role="group" aria-label="Performance result">
              <button aria-pressed={mode === "percentage"} onClick={() => setMode("percentage")}>Percentage</button>
              <button aria-pressed={mode === "estimate"} onClick={() => setMode("estimate")}>Estimated SAT range</button>
            </div>
          </div>
          {availableSections.length > 1 && (
            <div className="performance-scope result-scope" role="group" aria-label="Result scope">
              <button aria-pressed={scope === "overall"} onClick={() => setScope("overall")}>Overall</button>
              {availableSections.map((section) => (
                <button key={section} aria-pressed={scope === section} onClick={() => setScope(section)}>
                  {resultSectionLabel(section)}
                </button>
              ))}
            </div>
          )}
          {mode === "percentage" ? (
            <PerformanceGauge
              value={result.percentage}
              displayValue={percentage}
              label={`${scope === "overall" ? "Overall" : resultSectionLabel(scope)} scored accuracy`}
              detail={`${result.scored} scored questions`}
              ariaLabel={`${percentage} scored accuracy: ${result.correct} correct, ${result.incorrect} incorrect, ${result.unanswered} unanswered, ${result.scored} total scored questions`}
              footer={
                <div className="score-counts">
                  <span><strong>{result.correct}</strong> correct</span>
                  <span><strong>{result.incorrect}</strong> incorrect</span>
                  <span><strong>{result.unanswered}</strong> unanswered</span>
                  <span><strong>{result.scored}</strong> scored</span>
                </div>
              }
            />
          ) : (
            <ScoreEstimate data={data} session={session} scope={scope} percentage={percentage} />
          )}
          <p className="small muted scoring-note">
            Unanswered scored questions stay in the denominator. Simulated unscored questions are excluded.
          </p>
          {strongestDomain && (
            <div className="result-domain-glance" aria-label="Domain highlights">
              <span>
                <small>Strongest domain</small>
                <strong>{domainGlanceLabel(strongestDomain)}</strong>
                {formatPercentage((100 * strongestDomain.correct) / strongestDomain.scored)}
              </span>
              {weakestDomain && weakestDomain.key !== strongestDomain.key && (
                <span>
                  <small>Needs the most attention</small>
                  <strong>{domainGlanceLabel(weakestDomain)}</strong>
                  {formatPercentage((100 * weakestDomain.correct) / weakestDomain.scored)}
                </span>
              )}
            </div>
          )}
          <section className="module-performance" aria-labelledby="module-performance-heading">
            <h2 id="module-performance-heading">Module performance</h2>
            <div>
              {selected.map((module) => {
                const moduleResult = scoredSummary(data, session, [module]);
                return (
                  <details className="module-result-row" key={module.startedAt}>
                    <summary>
                      <span>{resultModuleLabel(module)}</span>
                      <span>
                        <strong>{formatPercentage(moduleResult.percentage)}</strong> · {moduleResult.correct}/{moduleResult.scored} · {formatElapsed(module.durationMs || 0)}
                      </span>
                    </summary>
                    <p className="small muted">
                      {moduleResult.correct} correct · {moduleResult.incorrect} incorrect · {moduleResult.unanswered} unanswered · {moduleResult.scored} scored
                    </p>
                  </details>
                );
              })}
            </div>
          </section>
          <section className="test-domain-performance" aria-labelledby="test-domains-heading">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">SCORING DETAIL</p>
                <h2 id="test-domains-heading">Domains &amp; skills</h2>
              </div>
              <p className="small muted">Scored questions only</p>
            </div>
            <div className="test-domain-groups">
              {availableSections
                .filter((section) => scope === "overall" || section === scope)
                .map((section) => (
                  <section key={section} aria-labelledby={`test-domain-${section}`}>
                    <h3 id={`test-domain-${section}`}>{resultSectionLabel(section)}</h3>
                    {domains.filter((domain) => domain.section === section).map((domain) => (
                      <details
                        className="domain-row"
                        key={domain.key}
                        open={openDomain[section] === domain.key}
                      >
                        <summary
                          onClick={(event) => {
                            event.preventDefault();
                            setOpenDomain((current) => ({
                              ...current,
                              [section]:
                                current[section] === domain.key
                                  ? undefined
                                  : domain.key,
                            }));
                          }}
                        >
                          <span className="domain-name">{domain.label}</span>
                          <span className="domain-metric">
                            {formatPercentage((100 * domain.correct) / Math.max(1, domain.scored))}
                            <small>{domain.attempted}/{domain.scored} attempted</small>
                          </span>
                        </summary>
                        <div className="domain-detail">
                          <div className="skill-performance">
                            {domain.skills.map((skill) => (
                              <div key={skill.key}>
                                <span>{skill.label}</span>
                                <span>{formatPercentage((100 * skill.correct) / Math.max(1, skill.scored))} · {skill.attempted}/{skill.scored} attempted</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ))}
                  </section>
                ))}
            </div>
          </section>
        </div>
      }
    />
  );
};
