import { useT } from "../i18n";

export type SessionMapProps = {
  questionIds: string[];
  /** The question on screen. */
  index: number;
  /** This session's checked answers. */
  attempts: { questionId: string; correct: boolean }[];
  /** Saved answers; in a test they mark a question as answered. */
  drafts: Record<string, string>;
  isTest: boolean;
  pending: boolean;
  onGo: (index: number) => void;
  onFinish: () => void;
};

/** One square per question, showing which are answered, and Finish. */
type SquareState = "answered" | "correct" | "incorrect" | "open";

/** In a test a saved answer only counts as answered; practice shows the result. */
const squareState = (
  saved: boolean,
  attempt?: { correct: boolean },
): SquareState => {
  if (saved) return "answered";
  if (!attempt) return "open";
  return attempt.correct ? "correct" : "incorrect";
};

const squareClass: Record<SquareState, string> = {
  answered: "map-answered",
  correct: "map-correct",
  incorrect: "map-incorrect",
  open: "",
};

export const SessionMap = ({
  questionIds,
  index: currentIndex,
  attempts,
  drafts,
  isTest,
  pending,
  onGo,
  onFinish,
}: SessionMapProps) => {
  const t = useT();
  const squareLabel: Record<SquareState, string> = {
    answered: t(", answered"),
    correct: t(", correct"),
    incorrect: t(", incorrect"),
    open: "",
  };
  return (
    <>
      <section className="utility">
        <h3>{t("Session map")}</h3>
        <div className="question-map">
          {questionIds.map((id, index) => {
            const state = squareState(
              isTest && !!drafts[id],
              attempts.find((a) => a.questionId === id),
            );
            return (
              <button
                key={id}
                aria-label={
                  t("Go to question {n}", { n: index + 1 }) + squareLabel[state]
                }
                aria-current={index === currentIndex ? "step" : undefined}
                className={`${squareClass[state]} ${index === currentIndex ? "current" : ""}`}
                disabled={pending}
                onClick={() => onGo(index)}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <p className="small muted">
          {t("Filled squares are answered. You can skip and return.")}
        </p>
      </section>
      <button onClick={onFinish} disabled={pending}>
        {isTest ? "Finish module" : t("Finish session")}
      </button>
    </>
  );
};
