import { useEffect, useRef, useState } from "react";
import type { ActiveMode } from "../importing/pdf/classify";
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
      mode: ActiveMode;
      overridesFile?: File;
      signal: AbortSignal;
      progress: (progress: Progress) => void;
    },
  ) => Promise<{ report: PrepareReport }>;
}

const MODES: { value: ActiveMode; label: string }[] = [
  {
    value: "active-only",
    label: "The active files contain only active questions.",
  },
  {
    value: "inclusive",
    label:
      "The active files contain every question, and the inactive files only the inactive ones.",
  },
  {
    value: "unknown",
    label:
      "I am not sure. Mark everything outside the inactive files as unknown.",
  },
];

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
  const [mode, setMode] = useState<ActiveMode>();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState("");
  const [report, setReport] = useState<PrepareReport>();
  const controller = useRef<AbortController | undefined>(undefined);
  const assigned = assignExports(files);

  // Closing the tab mid-run would waste minutes of work, so ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const ready = !assigned.missing.length && mode !== undefined && !running;
  const start = async () => {
    if (!mode) return;
    controller.current = new AbortController();
    setRunning(true);
    setError("");
    setReport(undefined);
    setProgress({ phase: "index", done: 0, total: 1, message: "Starting…" });
    try {
      const result = await prepare(files, {
        mode,
        overridesFile: overrides,
        signal: controller.current.signal,
        progress: setProgress,
      });
      setReport(result.report);
    } catch (e) {
      setError(
        controller.current.signal.aborted
          ? "Cancelled. Images already prepared are kept and are reused if you run it again."
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
      <h2 id="pdf-prepare-h">Prepare from your PDF exports</h2>
      <p>
        Choose all four exports:{" "}
        {EXPORT_NAMES.map((name, i) => (
          <span key={name}>
            {i ? ", " : ""}
            <code>{name}.pdf</code>
          </span>
        ))}
        . They are read and turned into question images in this browser; nothing
        is uploaded. The full exports take about 5 to 10 minutes, so keep
        this tab open.
      </p>
      <label className="file-button secondary">
        Choose the four PDFs
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
      <fieldset disabled={running}>
        <legend>What do the active files contain?</legend>
        {MODES.map((option) => (
          <label key={option.value} className="radio-row">
            <input
              type="radio"
              name="active-mode"
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
            />{" "}
            {option.label}
          </label>
        ))}
      </fieldset>
      <p className="small muted">
        Active questions stay hidden by default. Unknown is not a guarantee that
        a question is safe from spoilers.
      </p>
      <label className="small">
        Reviewed exceptions (optional JSON){" "}
        <input
          aria-label="Reviewed exceptions"
          type="file"
          accept=".json,application/json"
          disabled={running}
          onChange={(e) => setOverrides(e.target.files?.[0])}
        />
      </label>
      <div className="pdf-prepare-actions">
        <button
          className="primary"
          disabled={!ready}
          onClick={() => void start()}
        >
          Prepare library
        </button>
        {running && (
          <button onClick={() => controller.current?.abort()}>Cancel</button>
        )}
      </div>
      {running && progress && (
        <div className="pdf-prepare-progress">
          <progress
            aria-label="Preparation progress"
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
            <strong>
              Prepared {report.importedQuestions} of {report.uniqueSourceIds}{" "}
              questions.
            </strong>{" "}
            {report.quarantined.length
              ? `${report.quarantined.length} could not be read safely and were left out.`
              : "None were left out."}
          </p>
          <p className="small muted">
            {Object.entries(report.counts.testStatus)
              .map(([status, count]) => `${count} ${status}`)
              .join(", ")}
            .
          </p>
          {report.quarantined.slice(0, 5).map((item) => (
            <p key={item.sourceId} className="small">
              {item.sourceId} ({item.file}, pages {item.pages.join(", ")}):{" "}
              {item.reason}
            </p>
          ))}
          <button className="secondary" onClick={() => download(report)}>
            Download report
          </button>
        </div>
      )}
    </section>
  );
}
