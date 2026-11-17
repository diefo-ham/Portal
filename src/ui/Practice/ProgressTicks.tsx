export type ProgressTicksProps = {
  questionIds: string[];
  /** The question on screen. */
  index: number;
  /** This session's checked answers. */
  attempts: { questionId: string; correct: boolean }[];
  /** Saved answers; in a test they mark a question as answered. */
  drafts: Record<string, string>;
  /** A test shows only "answered", never right or wrong. */
  isTest: boolean;
  /** Present when any question may be opened directly. */
  onGo?: (index: number) => void;
};

/**
 * One tick per question: where you are and how each one went. It repeats what the
 * question overview says, so it is hidden from assistive technology; clicking a
 * tick is a pointer shortcut for the overview's "Go to question" buttons.
 */
export const ProgressTicks = ({
  questionIds,
  index: currentIndex,
  attempts,
  drafts,
  isTest,
  onGo,
}: ProgressTicksProps) => (
  <div
    className={`progress-ticks ${questionIds.length > 40 ? "dense" : ""} ${onGo ? "can-go" : ""}`}
    aria-hidden="true"
  >
    {questionIds.map((id, index) => {
      const attempt = attempts.find((a) => a.questionId === id);
      const state =
        isTest && drafts[id]
          ? "answered"
          : !attempt
            ? "open"
            : attempt.correct
              ? "correct"
              : "incorrect";
      return (
        <span
          key={id}
          className={`tick-${state} ${index === currentIndex ? "current" : ""}`}
          onClick={onGo ? () => onGo(index) : undefined}
        />
      );
    })}
  </div>
);
