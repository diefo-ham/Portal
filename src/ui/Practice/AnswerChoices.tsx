import type { Question } from "../../core/model";
import { numericValue } from "../../core/practice";
import { useT } from "../i18n";

export type AnswerChoicesProps = {
  question: Question;
  /** The chosen letter or the typed number; empty for none. */
  answer: string;
  /** Present once the answer has been checked. */
  attempt?: { correct: boolean };
  disabled: boolean;
  onChange: (answer: string) => void;
  /** Enter in the number field, once the number is valid. */
  onSubmit: () => void;
};

/** The answer choices as radio buttons, or a field for a numeric answer. */
export const AnswerChoices = ({
  question,
  answer,
  attempt,
  disabled,
  onChange,
  onSubmit,
}: AnswerChoicesProps) => {
  const t = useT();
  return (
    <fieldset className="answers" disabled={disabled}>
      <legend className="sr-only">{t("Your answer")}</legend>
      {question.answer.type === "choice" ? (
        (question.choices ?? []).map((c) => (
          <label
            className={`answer-choice ${answer === c.id ? "chosen" : ""} ${attempt && !attempt.correct && answer === c.id ? "wrong-answer" : ""} ${attempt && question.answer.type === "choice" && question.answer.value === c.id ? "right-answer" : ""}`}
            key={c.id}
          >
            <input
              type="radio"
              name="answer"
              value={c.id}
              checked={answer === c.id}
              onClick={(event) => {
                // Choosing the chosen answer again clears it.
                if (answer === c.id) {
                  event.preventDefault();
                  onChange("");
                }
              }}
              onChange={() => onChange(c.id)}
            />
            <span className="choice-letter">{c.id}</span>
            {!question.document && <span>{c.text}</span>}
          </label>
        ))
      ) : (
        <label className="numeric-answer">
          {t("Your answer")}
          <input
            aria-label={t("Your numeric answer")}
            inputMode="text"
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("Enter a number or fraction")}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !disabled &&
                !attempt &&
                numericValue(answer) !== undefined
              ) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <span className="small muted">
            {question.assessment === "PAA"
              ? t(
                  "Positive numbers only, up to 4 characters (for example, 7.5 or 15/2). Mixed numbers are not accepted.",
                )
              : t("Decimals and fractions accepted (for example, 0.5 or 1/2).")}
          </span>
          {answer && numericValue(answer) === undefined && (
            <span className="incorrect small">
              {t(
                "Enter a valid number or fraction with a nonzero denominator.",
              )}
            </span>
          )}
        </label>
      )}
    </fieldset>
  );
};
