import type { Question } from "../../core/model";
import { useT } from "../i18n";

export type QuestionDetailsProps = { question: Question };

/** Difficulty, skill, source and, for PDFs, where the question came from. */
export const QuestionDetails = ({ question }: QuestionDetailsProps) => {
  const t = useT();
  return (
    <div className="source-details">
      <p>
        {t("Difficulty: {difficulty}", {
          difficulty: question.difficulty
            ? t(question.difficulty)
            : t("Unspecified"),
        })}
      </p>
      <p>
        {question.skill || t("Skill unspecified")}
        {question.skillDetail ? ` · ${question.skillDetail}` : ""}
      </p>
      <p>
        {question.source || t("Source unspecified")}
        {question.sourceId ? ` · ${question.sourceId}` : ""}
      </p>
      {question.assessment !== "PAA" && (
        <p>Practice-test status: {question.testStatus}</p>
      )}
      {question.document && (
        <details>
          <summary>{t("PDF source details")}</summary>
          {question.document.provenance.map((p) => (
            <p key={p.filename}>
              {t("{file} · pages {pages}", {
                file: p.filename,
                pages: p.pages.join(", "),
              })}
            </p>
          ))}
          <p>
            {t(
              "Original layout is shown above. Search text was extracted automatically and may omit math notation.",
            )}
          </p>
        </details>
      )}
    </div>
  );
};
