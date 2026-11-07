import { assessmentInfo } from "../../core/assessments";
import type { Question, Session, StudyData } from "../../core/model";
import { sessionOutcomes } from "../../core/review";
import { metadataKey } from "../../core/taxonomy";

export type TsiTestSummaryProps = { data: StudyData; session: Session };

/**
 * The headline of a finished TSI practice test: percent correct and how each
 * domain went. There is no scaled score and no pass or fail: the real TSIA2
 * adapts to each student and College Board publishes no conversion. The TSI
 * portal is in English, so this is written plainly.
 */
export const TsiTestSummary = ({ data, session }: TsiTestSummaryProps) => {
  const result = sessionOutcomes(data, session);
  const total = session.questionIds.length;
  const correct = new Set(result.correct);
  const questions = session.questionIds
    .map((id) => data.questions.find((question) => question.id === id))
    .filter((question): question is Question => !!question);
  const order = Object.values(assessmentInfo("TSI").domains).flat();
  const rank = (name: string) =>
    order.findIndex((known) => metadataKey(known) === metadataKey(name));
  const domains = [
    ...new Set(questions.map((question) => question.domain ?? "")),
  ]
    .filter(Boolean)
    .sort((a, b) => rank(a) - rank(b));
  const percent = total ? Math.round((100 * result.correct.length) / total) : 0;
  return (
    <>
      <h1>
        {result.correct.length} of {total} correct.
      </h1>
      <p className="muted">
        {percent}% correct.{" "}
        {result.unanswered.length
          ? `${result.unanswered.length} ${result.unanswered.length === 1 ? "question was" : "questions were"} not answered and count as not correct.`
          : "Every question answered."}
      </p>
      <div
        className="outcome-bar"
        role="img"
        aria-label={`${result.correct.length} correct, ${result.incorrect.length} incorrect, ${result.unanswered.length} unanswered`}
      >
        {(["correct", "incorrect", "unanswered"] as const).map((kind) => (
          <span
            key={kind}
            className={kind}
            style={{ flex: result[kind].length }}
          />
        ))}
      </div>
      <p className="outcome-legend">
        <span>{result.correct.length} correct</span>
        <span>{result.incorrect.length} incorrect</span>
        <span>{result.unanswered.length} unanswered</span>
      </p>
      <section className="tsi-test-domains" aria-label="Performance by domain">
        <h2>Performance by domain</h2>
        <ul>
          {domains.map((domain) => {
            const mine = questions.filter(
              (question) => question.domain === domain,
            );
            const right = mine.filter((question) =>
              correct.has(question.id),
            ).length;
            return (
              <li key={domain}>
                <span>{domain}</span>
                <span>
                  {right} of {mine.length} ·{" "}
                  {Math.round((100 * right) / mine.length)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="small muted">
        This is practice accuracy, not a TSIA2 score. The real test adapts to
        each student and College Board publishes no way to convert practice
        answers into a score, so there is no score and no pass or fail here.
      </p>
      {session.tsiTest?.shortfall?.length ? (
        <p className="small muted">
          This test had fewer questions than the real one, because the bank had
          fewer to use: {session.tsiTest.shortfall.join("; ")}.
        </p>
      ) : null}
    </>
  );
};
