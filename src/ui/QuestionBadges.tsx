import type { Question } from "../core/model";
import { useT } from "./i18n";

/** "Official" (a College Board sample item) or "Original" (written for this portal), TSI only. */
export const OriginBadge = ({ question }: { question: Question }) => {
  const t = useT();
  if (!question.origin) return null;
  const official = question.origin === "official";
  return (
    <span
      className={`origin-badge ${question.origin}`}
      title={t(
        official ? "College Board sample item" : "Original practice item",
      )}
    >
      {t(official ? "Official" : "Original")}
    </span>
  );
};

/** The on-screen calculator the real test offers for this item, TSI Math only. */
export const CalculatorChip = ({ question }: { question: Question }) => {
  const t = useT();
  if (!question.calculator) return null;
  return (
    <span className="calculator-chip">
      {question.calculator === "basic"
        ? t("Basic calculator")
        : question.calculator === "sqrt"
          ? t("Square root calculator")
          : t("Graphing calculator")}
    </span>
  );
};
