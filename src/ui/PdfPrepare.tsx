import { useEffect, useRef, useState } from "react";
import {
  assignExports,
  EXPORT_NAMES,
  type PrepareReport,
  type Progress,
} from "../importing/pdf/prepare";

interface Props {
  /** Runs the preparation and adopts the resulting library. */
  prepare: (
    files: File[],
    options: {
      overridesFile?: File;
      signal: AbortSignal;
      progress: (progress: Progress) => void;
    },
  ) => Promise<{ report: PrepareReport; result?: { unchanged: boolean } }>;
}

const SUBJECTS: Record<string, string> = {
  read_write: "Reading & Writing",
  math: "Math",
};

/** Plain-language account of how the active and inactive files were read. */
export function explainClassification(report: PrepareReport): string[] {
  const lines = Object.entries(report.interpretation).map(([group, mode]) => {
    const subject = SUBJECTS[group] ?? group;
    if (mode === "active-only")
      return `The two ${subject} files share no questions, so the questions in the active file were marked active.`;
    if (mode === "inclusive")
      return `The active ${subject} file also contains the inactive questions, so only the questions found nowhere else were marked active.`;
    return `Every ${subject} question outside the inactive file was marked unknown.`;
  });
  for (const conflict of report.conflicts)
    lines.push(
      `The ${SUBJECTS[conflict.section] ?? conflict.section} files overlap unevenly, so the questions that could not be classified were marked unknown.`,
    );
  return lines;
}

const download = (report: PrepareReport) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "pdf-preparation-report.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function PdfPrepare({ prepare }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [overrides, setOverrides] = useState<File>();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState("");
  const [report, setReport] = useState<PrepareReport>();
  const [unchanged, setUnchanged] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const assigned = assignExports(files);

  // Closing the tab mid-run would waste minutes of work, so ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const ready = files.length > 0 && !assigned.missing.length && !running;
  const start = async () => {
    controller.current = new AbortController();
    setRunning(true);
    setError("");
    setReport(undefined);
    setProgress({ phase: "index", done: 0, total: 1, message: "Starting…" });
    try {
      const result = await prepare(files, {
        overridesFile: overrides,
        signal: controller.current.signal,
        progress: setProgress,
      });
      setReport(result.report);
      setUnchanged(result.result?.unchanged === true);
    } catch (e) {
      setError(
        controller.current.signal.aborted
          ? "Cancelled. What was already prepared is kept and is reused if you start again."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="data-card pdf-prepare" aria-labelledby="pdf-prepare-h">
      <h2 id="pdf-prepare-h">Add your question PDFs</h2>
      <p>
        Choose the four PDF exports from your question bank. They are read in
        this browser and never uploaded, and the whole set takes about 5 to 10
        minutes. Keep this tab open while it works.
      </p>
      <label className="file-button secondary">
        Choose the PDFs
        <input
          aria-label="PDF export files"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={running}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setReport(undefined);
            setError("");
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="pdf-prepare-files" aria-label="Chosen exports">
          {EXPORT_NAMES.map((name) => (
            <li key={name}>
              {assigned.found[name] ? "✓" : "–"} <code>{name}.pdf</code>
              {assigned.found[name] ? "" : " (not chosen)"}
            </li>
          ))}
          {assigned.unrecognized.map((name) => (
            <li key={name} className="muted">
              Ignored: {name}
            </li>
          ))}
        </ul>
      )}
      <details className="pdf-prepare-advanced">
        <summary>Advanced</summary>
        <label className="small">
          Reviewed exceptions (optional JSON file){" "}
          <input
            aria-label="Reviewed exceptions"
            type="file"
            accept=".json,application/json"
            disabled={running}
            onChange={(e) => setOverrides(e.target.files?.[0])}
          />
        </label>
      </details>
      <div className="pdf-prepare-actions">
        <button
          className="primary"
          disabled={!ready}
          onClick={() => void start()}
        >
          Add questions
        </button>
        {running && (
          <button onClick={() => controller.current?.abort()}>Cancel</button>
        )}
      </div>
      {running && progress && (
        <div className="pdf-prepare-progress">
          <progress
            aria-label="Progress"
            max={progress.total}
            value={progress.done}
          />
          <p role="status">{progress.message}</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {report && (
        <div className="pdf-prepare-report" role="status">
          <p>
            {unchanged ? (
              <>
                <strong>Nothing changed.</strong> These PDFs give exactly the{" "}
                {report.importedQuestions} questions and images already stored.
                If the stored ones look wrong, use Free up space → Remove my
                questions, then add the PDFs again.{" "}
              </>
            ) : (
              <strong>Added {report.importedQuestions} questions.</strong>
            )}{" "}
            {report.quarantined.length
              ? `${report.quarantined.length} could not be read safely and were left out.`
              : ""}
          </p>
          <p className="small muted">
            {report.counts.testStatus.active ?? 0} are marked active and stay
            hidden until you choose to include them;{" "}
            {report.counts.testStatus.inactive ?? 0} are inactive
            {report.counts.testStatus.unknown
              ? `; ${report.counts.testStatus.unknown} are unknown`
              : ""}
            .
          </p>
          <details>
            <summary>How this was worked out</summary>
            {explainClassification(report).map((line) => (
              <p key={line} className="small">
                {line}
              </p>
            ))}
            {report.quarantined.slice(0, 5).map((item) => (
              <p key={item.sourceId} className="small">
                Left out: {item.sourceId} ({item.file}, pages{" "}
                {item.pages.join(", ")}): {item.reason}
              </p>
            ))}
            <button className="secondary" onClick={() => download(report)}>
              Download report
            </button>
          </details>
        </div>
      )}
    </section>
  );
}
