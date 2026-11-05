import type { Ref } from "react";
import { useT } from "../i18n";

export type QuestionFooterProps = {
  index: number;
  total: number;
  isTest: boolean;
  answered: boolean;
  /** A save is running or the session is paused. */
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  /** The forward button, focused once the question is answered. */
  nextButtonRef?: Ref<HTMLButtonElement>;
};

/** Previous, and Next (or Skip) or Finish on the last question. */
export const QuestionFooter = ({
  index,
  total,
  isTest,
  answered,
  disabled,
  onPrevious,
  onNext,
  onFinish,
  nextButtonRef,
}: QuestionFooterProps) => {
  const t = useT();
  const last = index >= total - 1;
  const forwardLabel = () => {
    if (last) return isTest ? "Finish module →" : t("Review session →");
    if (isTest) return "Next question →";
    return answered ? t("Next question →") : t("Skip for now →");
  };
  return (
    <div className="question-footer">
      <button disabled={index === 0 || disabled} onClick={onPrevious}>
        {t("← Previous")}
      </button>
      <button
        ref={nextButtonRef}
        className={answered ? "primary" : "text-button"}
        disabled={disabled}
        onClick={last ? onFinish : onNext}
      >
        {forwardLabel()}
      </button>
    </div>
  );
};
