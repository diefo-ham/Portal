import type { PrepareReport } from "../importing/pdf/prepare";
import { useT } from "./i18n";

export const downloadReport = (report: PrepareReport, name: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export type PdfReportProps = {
  kind: "SAT" | "PAA" | "TSI";
  report: PrepareReport;
  unchanged: boolean;
};

/** What one preparation did: how many questions, what was left out, how it was read. */
export const PdfReport = ({ kind, report, unchanged }: PdfReportProps) => {
  const t = useT();
  // The SAT marks questions active or inactive by the badge on each page; the PAA and TSI have no such concept.
  const paa = kind !== "SAT";
  const tsi = kind === "TSI";
  return (
    <div className="pdf-prepare-report" role="status">
      <p>
        {unchanged ? (
          <>
            <strong>{t("Nothing changed.")}</strong>{" "}
            {t(
              "These PDFs give exactly the {n} questions and images already stored.",
              { n: report.importedQuestions },
            )}{" "}
          </>
        ) : (
          <strong>
            {t("Added {n} questions.", { n: report.importedQuestions })}
          </strong>
        )}{" "}
        {report.quarantined.length
          ? t("{n} could not be read safely and were left out.", {
              n: report.quarantined.length,
            })
          : ""}
      </p>
      {!!report.refused?.length && (
        <p className="small">
          {t("Not added, because no page carries the access code: {files}", {
            files: report.refused.join(", "),
          })}
        </p>
      )}
      {!!report.ignored?.length && (
        <p className="small">
          {t("Set aside, because they are not question PDFs: {files}", {
            files: report.ignored.join(", "),
          })}
        </p>
      )}
      {tsi && report.counts.origin && (
        <p className="small muted">
          {t(
            "{official} College Board sample items and {original} original items.",
            {
              official: report.counts.origin.official ?? 0,
              original: report.counts.origin.original ?? 0,
            },
          )}
        </p>
      )}
      {!paa && (
        <p className="small muted">
          {t(
            "{active} are marked active and stay hidden until you choose to include them; {inactive} are inactive.",
            {
              active: report.counts.testStatus.active ?? 0,
              inactive: report.counts.testStatus.inactive ?? 0,
            },
          )}
          {report.counts.testStatus.unknown
            ? " " +
              t("{n} are unknown.", { n: report.counts.testStatus.unknown })
            : ""}
        </p>
      )}
      <details>
        <summary>{t("How this was worked out")}</summary>
        {!paa && (
          <p className="small">
            {t(
              "Each SAT question is marked active or inactive by the badge at the top right of its page; a page without a badge is marked unknown.",
            )}
          </p>
        )}
        {report.warnings?.slice(0, 5).map((warning) => (
          <p key={warning} className="small">
            {t("Noted: {warning}", { warning })}
          </p>
        ))}
        {report.quarantined.slice(0, 5).map((item) => (
          <p key={item.sourceId} className="small">
            {t("Left out: {id} ({file}, pages {pages}): {reason}", {
              id: item.sourceId,
              file: item.file,
              pages: item.pages.join(", "),
              reason: item.reason,
            })}
          </p>
        ))}
        <button
          className="secondary"
          onClick={() =>
            downloadReport(
              report,
              tsi
                ? "tsi-preparation-report.json"
                : paa
                  ? "paa-preparation-report.json"
                  : "pdf-preparation-report.json",
            )
          }
        >
          {t("Download report")}
        </button>
      </details>
    </div>
  );
};
