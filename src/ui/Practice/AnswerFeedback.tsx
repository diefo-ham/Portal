import type { Question } from "../../core/model";
import { DocumentPanels } from "../DocumentPanels";
import { useT } from "../i18n";
import { correctAnswer, displayAnswer } from "../SessionResults";
import { time } from "../formatTime";

export type AnswerFeedbackProps = {
  question: Question;
  attempt: { correct: boolean; answer: string; durationMs: number };
  /** Show the explanation open after a correct answer, not folded away. */
  showCorrectExplanations: boolean;
  /** Also show how long the answer took. */
  showTime: boolean;
};

/** Right or wrong, the correct answer, the explanation, and what you answered. */
export const AnswerFeedback = ({
  question,
  attempt,
  showCorrectExplanations,
  showTime,
}: AnswerFeedbackProps) => {
  const t = useT();
  const explanation = question.document ? (
    <DocumentPanels question={question} kind="rationale" />
  ) : (
    <p className="rationale">
      {question.rationale || t("No rationale was included in this import.")}
    </p>
  );
  return (
    <section
      className={`feedback ${attempt.correct ? "success" : "miss"}`}
      aria-live="polite"
    >
      <h2>
        {attempt.correct
          ? t("Correct. Nicely done.")
          : t("Not quite. Let’s work through it.")}
      </h2>
      <p>
        <strong>{t("Correct answer:")}</strong> {correctAnswer(question, t)}
      </p>
      {attempt.correct && !showCorrectExplanations ? (
        <details className="correct-explanation">
          <summary>{t("View explanation")}</summary>
          {explanation}
        </details>
      ) : (
        <>
          <h3>{t("Explanation")}</h3>
          {explanation}
        </>
      )}
      <span className="small muted">
        {t("Your answer: {answer}", {
          answer: displayAnswer(question, attempt.answer),
        })}
        {showTime ? ` · ${time(attempt.durationMs)}` : ""}
      </span>
    </section>
  );
};
