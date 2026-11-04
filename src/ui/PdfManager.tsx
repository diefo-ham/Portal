import { useRef, useState } from "react";
import { assessmentInfo, sectionLabel } from "../core/assessments";
import type { StudyData } from "../core/model";
import { summarizePdfs, type PdfSummary } from "../core/pdfLibrary";
import { useAssessment, useT } from "./i18n";

export type PdfManagerProps = {
  /** The study data; only this test's PDFs are listed. */
  data: StudyData;
  busy: boolean;
  /** Opens the pop-up where PDFs are dropped. */
  onAdd: () => void;
  onRemove: (key: string) => Promise<void>;
};

/** The PDFs the questions came from, with a way to add more and to take one out. */
export const PdfManager = ({
  data,
  busy,
  onAdd,
  onRemove,
}: PdfManagerProps) => {
  const t = useT();
  const assessment = useAssessment();
  const protectedTests = assessmentInfo(assessment).protectedTests;
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<PdfSummary>();
  const pdfs = summarizePdfs(data, assessment);
  const ask = (pdf: PdfSummary) => {
    setTarget(pdf);
    dialog.current?.showModal();
    cancel.current?.focus();
  };
  const statusLine = (pdf: PdfSummary) =>
    [
      pdf.status.active
        ? t("{n} active (hidden until you include them)", {
            n: pdf.status.active,
          })
        : "",
      pdf.status.inactive ? t("{n} inactive", { n: pdf.status.inactive }) : "",
      pdf.status.unknown ? t("{n} unknown", { n: pdf.status.unknown }) : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section className="data-card pdf-manager" aria-labelledby="pdf-manager-h">
      <div className="pdf-manager-head">
        <h2 id="pdf-manager-h">{t("Your question PDFs")}</h2>
        <button className="primary" disabled={busy} onClick={onAdd}>
          {t("Add PDFs")}
        </button>
      </div>
      <p>
        {pdfs.length
          ? t(
              "These are the PDFs your questions came from. Add more, or take one out; your answers and bookmarks are kept.",
            )
          : t(
              "No PDFs added yet. Add your question PDFs: they are read in this browser and never uploaded.",
            )}
      </p>
      {pdfs.length > 0 && (
        <ul className="pdf-list" aria-label={t("Your question PDFs")}>
          {pdfs.map((pdf) => (
            <li key={pdf.key}>
              <div>
                <strong>
                  <code>{pdf.filename}</code>
                </strong>
                <span className="small muted pdf-list-detail">
                  {pdf.sections.map(sectionLabel).join(" · ")}
                  {" · "}
                  {t("{n} questions", { n: pdf.questions.toLocaleString() })}
                  {protectedTests && statusLine(pdf)
                    ? " · " + statusLine(pdf)
                    : ""}
                </span>
              </div>
              <button
                className="text-button danger"
                disabled={busy}
                aria-label={t("Remove {name}", { name: pdf.filename })}
                onClick={() => ask(pdf)}
              >
                {t("Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="pdf-remove-title"
      >
        <h2 id="pdf-remove-title">
          {t("Remove {name}?", { name: target?.filename ?? "" })}
        </h2>
        <p>
          {t(
            "This deletes the {n} questions that come only from this PDF, and their images, from this browser, and ends saved sessions that use them. Your answers and bookmarks are kept and apply again when you add the PDF again.",
            { n: target?.onlyHere ?? 0 },
          )}
        </p>
        {target && target.onlyHere < target.questions && (
          <p className="small muted">
            {t("{n} questions also come from another PDF and stay.", {
              n: target.questions - target.onlyHere,
            })}
          </p>
        )}
        {protectedTests && (
          <p className="small muted">
            {t(
              "The SAT exports are read together, so to add this one back, add all four again.",
            )}
          </p>
        )}
        <p className="small muted">
          {t("Your original PDFs are not touched.")}
        </p>
        <div className="row reset-actions">
          <button ref={cancel} onClick={() => dialog.current?.close()}>
            {t("Cancel")}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              if (target) void onRemove(target.key);
            }}
          >
            {t("Remove PDF")}
          </button>
        </div>
      </dialog>
    </section>
  );
};
