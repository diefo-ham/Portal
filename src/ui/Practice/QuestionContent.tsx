import type { Question } from "../../core/model";
import { DocumentPanels } from "../DocumentPanels";
import { useT } from "../i18n";

export type QuestionContentProps = { question: Question };

/** The passage, figures and question, as text or as the original PDF panels. */
export const QuestionContent = ({ question }: QuestionContentProps) => {
  const t = useT();
  return (
    <>
      {question.passage && !question.document && (
        <div className="passage">{question.passage}</div>
      )}
      {question.media?.map((m, i) => (
        <figure key={i}>
          <img src={m.dataUrl} alt={m.alt} />
          <figcaption>{m.alt}</figcaption>
        </figure>
      ))}
      {question.document ? (
        <>
          <h1 className="sr-only">
            {t("Question {id}", { id: question.sourceId ?? "" })}
          </h1>
          {question.document.extractionWarnings?.map((warning, i) => (
            <p className="notice" key={i}>
              {warning}
            </p>
          ))}
          <DocumentPanels question={question} kind="question" />
          <p className="small muted">
            {question.answer.type === "choice"
              ? t("Select an answer from the choices shown above.")
              : t("Enter your answer below.")}
          </p>
        </>
      ) : (
        <h1 className="question-text">{question.stem}</h1>
      )}
    </>
  );
};
