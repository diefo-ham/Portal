import type { Question } from "../../core/model";
import { sectionName } from "../Filters";
import { useT } from "../i18n";
import { CalculatorChip, OriginBadge } from "../QuestionBadges";

export type QuestionHeadingProps = {
  question: Question;
  /** In a Practice Test the button marks for review instead of bookmarking. */
  isTest: boolean;
  /** Bookmarked, or marked for review in a test. */
  marked: boolean;
  /** `byPointer` is true for a mouse or touch press, false for the keyboard. */
  onToggle: (byPointer: boolean) => void;
};

/** The part and domain, and the bookmark (or mark-for-review) button. */
export const QuestionHeading = ({
  question,
  isTest,
  marked,
  onToggle,
}: QuestionHeadingProps) => {
  const t = useT();
  // A test marks questions for review; practice bookmarks them.
  const mark = isTest
    ? {
        label: marked ? "Unmark for review" : "Mark for review",
        title: `${marked ? "Unmark" : "Mark"} for review (E)`,
        icon: marked ? "⚑" : "⚐",
      }
    : {
        label: marked ? t("Remove bookmark") : t("Bookmark question"),
        title: marked ? t("Remove bookmark (E)") : t("Bookmark question (E)"),
        icon: marked ? "★" : "☆",
      };
  return (
    <div className="question-heading">
      <div>
        <p className="eyebrow">{sectionName(question.section)}</p>
        <span className="muted small">{question.domain || ""}</span>
        <OriginBadge question={question} />
        <CalculatorChip question={question} />
      </div>
      <button
        className={`${isTest ? "review-mark" : "bookmark"} ${marked ? "selected" : ""}`}
        aria-pressed={marked}
        aria-label={mark.label}
        title={mark.title}
        onClick={(e) => onToggle(e.detail > 0)}
      >
        <span aria-hidden="true">{mark.icon}</span>
        {isTest && <span>Mark for review</span>}
      </button>
    </div>
  );
};
