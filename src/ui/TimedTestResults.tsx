import { useMemo, useState } from "react";
import { sectionLabel } from "../core/assessments";
import type { Section, Session, StudyData } from "../core/model";
import { PART_ORDER, segmentLabel } from "../core/timedTest";
import { PerformanceGauge } from "./PerformanceGauge";
import {
  domainResultsOf,
  formatPercentage,
  type DomainResult,
} from "./PracticeTestResults";
import { SessionResults } from "./SessionResults";
import { formatElapsed } from "./formatTime";

/**
 * The results of a PAA test, laid out like the SAT Practice Test's: a gauge with
 * the counts, the strongest and weakest domain, how each timed part went, and
 * the domains and skills. Written in Spanish directly, like the rest of test
 * mode. There is no score: the PAA's is converted from the whole test.
 */
type Scope = "overall" | Section;

export type TimedTestResultsProps = {
  data: StudyData;
  session: Session;
  mutate: (fn: (data: StudyData) => void) => Promise<StudyData>;
  onBack: () => void;
  onRetry: (ids: string[], kind: "mistakes" | "unanswered" | "entire") => void;
};

export const TimedTestResults = ({
  data,
  session,
  mutate,
  onBack,
  onRetry,
}: TimedTestResultsProps) => {
  const test = session.timedTest!;
  const [scope, setScope] = useState<Scope>("overall");
  const [openDomain, setOpenDomain] = useState<
    Partial<Record<Section, string>>
  >({});
  const sectionOf = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q.section])),
    [data.questions],
  );
  const attempts = useMemo(
    () =>
      new Map(
        data.attempts
          .filter((attempt) => attempt.sessionId === session.id)
          .map((attempt) => [attempt.questionId, attempt]),
      ),
    [data.attempts, session.id],
  );
  const present = PART_ORDER.filter((part) =>
    session.questionIds.some((id) => sectionOf.get(id) === part),
  );
  const inScope = (id: string) =>
    scope === "overall" || sectionOf.get(id) === scope;
  const count = (ids: string[]) => {
    const correct = ids.filter((id) => attempts.get(id)?.correct).length;
    const answered = ids.filter((id) => attempts.has(id)).length;
    return {
      total: ids.length,
      correct,
      incorrect: answered - correct,
      unanswered: ids.length - answered,
      percentage: ids.length ? (100 * correct) / ids.length : 0,
    };
  };
  const ids = useMemo(
    () =>
      session.questionIds.filter(
        (id) => scope === "overall" || sectionOf.get(id) === scope,
      ),
    [session.questionIds, sectionOf, scope],
  );
  const result = count(ids);
  const percentage = formatPercentage(result.percentage);
  const domains = useMemo(
    () => domainResultsOf(data, session, ids),
    [data, session, ids],
  );
  const ranked = [...domains].sort(
    (a, b) =>
      b.correct / Math.max(1, b.scored) - a.correct / Math.max(1, a.scored),
  );
  const strongest = ranked[0];
  const weakest = ranked.at(-1);
  const glanceLabel = (domain: DomainResult) =>
    `${scope === "overall" && present.length > 1 ? `${sectionLabel(domain.section)} · ` : ""}${domain.label}`;
  const scopeLabel = scope === "overall" ? "General" : sectionLabel(scope);
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
              <h1>Resultados de la prueba</h1>
              <p className="muted">
                Una vista de lo que pasó, con detalle cuando lo quieras. Tiempo
                total: {formatElapsed(test.durationMs ?? 0)}.
              </p>
            </div>
          </div>
          {present.length > 1 && (
            <div
              className="performance-scope result-scope"
              role="group"
              aria-label="Parte de los resultados"
            >
              <button
                aria-pressed={scope === "overall"}
                onClick={() => setScope("overall")}
              >
                General
              </button>
              {present.map((part) => (
                <button
                  key={part}
                  aria-pressed={scope === part}
                  onClick={() => setScope(part)}
                >
                  {sectionLabel(part)}
                </button>
              ))}
            </div>
          )}
          <PerformanceGauge
            value={result.percentage}
            displayValue={percentage}
            label={`Aciertos · ${scopeLabel}`}
            detail={`${result.total} ${result.total === 1 ? "pregunta" : "preguntas"}`}
            ariaLabel={`${percentage} de aciertos: ${result.correct} correctas, ${result.incorrect} incorrectas, ${result.unanswered} sin contestar, ${result.total} en total`}
            footer={
              <div className="score-counts">
                <span>
                  <strong>{result.correct}</strong> correctas
                </span>
                <span>
                  <strong>{result.incorrect}</strong> incorrectas
                </span>
                <span>
                  <strong>{result.unanswered}</strong> sin contestar
                </span>
                <span>
                  <strong>{result.total}</strong> en total
                </span>
              </div>
            }
          />
          <p className="small muted scoring-note">
            Las preguntas sin contestar cuentan como incorrectas, como en la
            prueba real. Es el porcentaje de aciertos de esta prueba de
            práctica, no una puntuación de la PAA: la puntuación real se
            convierte a partir de la prueba completa.
          </p>
          {strongest && (
            <div
              className="result-domain-glance"
              aria-label="Dominios destacados"
            >
              <span>
                <small>Dominio más fuerte</small>
                <strong>{glanceLabel(strongest)}</strong>
                {formatPercentage((100 * strongest.correct) / strongest.scored)}
              </span>
              {weakest && weakest.key !== strongest.key && (
                <span>
                  <small>Necesita más atención</small>
                  <strong>{glanceLabel(weakest)}</strong>
                  {formatPercentage((100 * weakest.correct) / weakest.scored)}
                </span>
              )}
            </div>
          )}
          <section
            className="module-performance"
            aria-labelledby="part-performance-heading"
          >
            <h2 id="part-performance-heading">Rendimiento por parte</h2>
            <div>
              {test.segments.map((segment) => {
                const segmentIds = segment.questionIds.filter(inScope);
                if (!segmentIds.length) return null;
                const row = count(segmentIds);
                const used = segment.durationMs ?? 0;
                const outOfTime =
                  segment.limitMs !== undefined && used >= segment.limitMs;
                return (
                  <details className="module-result-row" key={segment.key}>
                    <summary>
                      <span>{segmentLabel(segment)}</span>
                      <span>
                        <strong>{formatPercentage(row.percentage)}</strong> ·{" "}
                        {row.correct}/{row.total} · {formatElapsed(used)}
                      </span>
                    </summary>
                    <p className="small muted">
                      {row.correct} correctas · {row.incorrect} incorrectas ·{" "}
                      {row.unanswered} sin contestar · tiempo permitido:{" "}
                      {segment.limitMs === undefined
                        ? "sin límite"
                        : formatElapsed(segment.limitMs)}
                      {outOfTime ? " (se acabó el tiempo)" : ""}
                    </p>
                  </details>
                );
              })}
            </div>
          </section>
          <section
            className="test-domain-performance"
            aria-labelledby="test-domains-heading"
          >
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">DETALLE</p>
                <h2 id="test-domains-heading">Dominios y destrezas</h2>
              </div>
            </div>
            <div className="test-domain-groups">
              {present
                .filter((part) => scope === "overall" || part === scope)
                .map((part) => (
                  <section key={part} aria-labelledby={`test-domain-${part}`}>
                    <h3 id={`test-domain-${part}`}>{sectionLabel(part)}</h3>
                    {domains
                      .filter((domain) => domain.section === part)
                      .map((domain) => (
                        <details
                          className="domain-row"
                          key={domain.key}
                          open={openDomain[part] === domain.key}
                        >
                          <summary
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenDomain((current) => ({
                                ...current,
                                [part]:
                                  current[part] === domain.key
                                    ? undefined
                                    : domain.key,
                              }));
                            }}
                          >
                            <span className="domain-name">{domain.label}</span>
                            <span className="domain-metric">
                              {formatPercentage(
                                (100 * domain.correct) /
                                  Math.max(1, domain.scored),
                              )}
                              <small>
                                {domain.attempted}/{domain.scored} contestadas
                              </small>
                            </span>
                          </summary>
                          <div className="domain-detail">
                            <div className="skill-performance">
                              {domain.skills.map((skill) => (
                                <div key={skill.key}>
                                  <span>{skill.label}</span>
                                  <span>
                                    {formatPercentage(
                                      (100 * skill.correct) /
                                        Math.max(1, skill.scored),
                                    )}{" "}
                                    · {skill.attempted}/{skill.scored}{" "}
                                    contestadas
                                  </span>
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
