import { useEffect, useRef, useState } from "react";
import {
  assignExports,
  EXPORT_NAMES,
  type ExportName,
  type PrepareReport,
  type Progress,
} from "../importing/pdf/prepare";
import { readDrop } from "./droppedFiles";
import { useT } from "./i18n";
import { PdfReport } from "./PdfReport";

export type PrepareFiles = (
  files: File[],
  options: {
    overridesFile?: File;
    signal: AbortSignal;
    progress: (progress: Progress) => void;
  },
) => Promise<{ report: PrepareReport; result?: { unchanged: boolean } }>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The four SAT exports, read together. */
  prepareSat: PrepareFiles;
  /** Any PAA exports; PDFs that are not PAA question exports are set aside. */
  preparePaa: PrepareFiles;
}

interface Outcome {
  kind: "SAT" | "PAA";
  report?: PrepareReport;
  unchanged?: boolean;
  error?: string;
}

const isPdf = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

const megabytes = (bytes: number) =>
  bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

/**
 * Drop the PDFs here. The SAT exports are recognised by name and read as a set;
 * everything else is read as a PAA export, and anything that is not one is set
 * aside. Nothing is guessed in advance: the PAA check looks at the contents.
 */
export function AddPdfsDialog({ open, ...rest }: Props) {
  // Mounted only while open: every opening starts clean, and a closed dialog
  // leaves nothing in the page for screen readers or other dialogs to meet.
  return open ? <OpenDialog {...rest} /> : null;
}

function OpenDialog({ onClose, prepareSat, preparePaa }: Omit<Props, "open">) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [notPdf, setNotPdf] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<File>();
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Closing the tab mid-run would waste minutes of work, so ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const sat = assignExports(files);
  const satNames = Object.keys(sat.found) as ExportName[];
  const satReady = satNames.length > 0 && !sat.missing.length;
  const inSatSet = new Set<unknown>(Object.values(sat.found));
  const paaFiles = files.filter((file) => !inSatSet.has(file));
  const satFiles = satReady
    ? EXPORT_NAMES.map((name) => sat.found[name] as File)
    : [];
  const canStart = (satReady || paaFiles.length > 0) && !running;

  const add = (incoming: File[]) => {
    if (running || !incoming.length) return;
    const pdfs = incoming.filter(isPdf);
    setNotPdf(incoming.filter((file) => !isPdf(file)).map((file) => file.name));
    setOutcomes([]);
    setError("");
    setFiles((current) => [
      ...current,
      ...pdfs.filter(
        (file) =>
          !current.some(
            (known) => known.name === file.name && known.size === file.size,
          ),
      ),
    ]);
  };

  const start = async () => {
    const jobs: { kind: "SAT" | "PAA"; files: File[]; run: PrepareFiles }[] =
      [];
    if (satReady) jobs.push({ kind: "SAT", files: satFiles, run: prepareSat });
    if (paaFiles.length)
      jobs.push({ kind: "PAA", files: paaFiles, run: preparePaa });
    const signal = (controller.current = new AbortController()).signal;
    setRunning(true);
    setError("");
    setOutcomes([]);
    setProgress({
      phase: "index",
      done: 0,
      total: 1,
      message: t("Starting…"),
    });
    const done: Outcome[] = [];
    for (const job of jobs) {
      try {
        const result = await job.run(job.files, {
          overridesFile: overrides,
          signal,
          progress: (next) =>
            setProgress(
              jobs.length > 1
                ? { ...next, message: `${job.kind}: ${next.message}` }
                : next,
            ),
        });
        done.push({
          kind: job.kind,
          report: result.report,
          unchanged: result.result?.unchanged === true,
        });
      } catch (e) {
        if (signal.aborted) {
          setError(
            t(
              "Cancelled. What was already prepared is kept and is reused if you start again.",
            ),
          );
          break;
        }
        const message = e instanceof Error ? e.message : String(e);
        done.push({
          kind: job.kind,
          // The PAA reader says in Spanish that nothing in the batch qualified.
          error:
            job.kind === "PAA" && message.startsWith("Ninguno de los PDF")
              ? t(
                  "None of these PDFs is a question export, so nothing was added. Set aside: {files}",
                  { files: job.files.map((file) => file.name).join(", ") },
                )
              : message,
        });
      }
    }
    setOutcomes(done);
    setRunning(false);
    // What was added leaves the list; a failed or cancelled part stays to retry.
    const added = new Set<File>(
      done
        .filter((outcome) => outcome.report)
        .flatMap((outcome) => (outcome.kind === "SAT" ? satFiles : paaFiles)),
    );
    setFiles((current) => current.filter((file) => !added.has(file)));
  };

  const tag = (file: File) => {
    const name = satNames.find((candidate) => sat.found[candidate] === file);
    if (!name) return t("PAA export, or set aside (checked when reading)");
    const subject = name.startsWith("math")
      ? t("Math")
      : t("Reading & Writing");
    const status = name.endsWith("_inactive") ? t("inactive") : t("active");
    return `${t("SAT")} · ${subject} · ${status}`;
  };

  const missing = sat.missing.map((name) => `${name}.pdf`).join(", ");
  const close = () => {
    if (!running) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="practice-dialog add-pdfs-dialog"
      aria-labelledby="add-pdfs-title"
      onCancel={(event) => {
        if (running) event.preventDefault();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      // A PDF dropped beside the drop area must not make the browser open it.
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = running ? "none" : "copy";
        if (!running) setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        // Folders are walked, so a folder of exports can be dropped as it is.
        readDrop(event.dataTransfer).then(add, (e: unknown) =>
          setError(e instanceof Error ? e.message : String(e)),
        );
      }}
    >
      <div className="dialog-heading">
        <h2 id="add-pdfs-title">{t("Add your question PDFs")}</h2>
        <button
          aria-label={t("Close window")}
          disabled={running}
          onClick={() => close()}
        >
          ×
        </button>
      </div>
      <p className="small muted">
        {t(
          "Drop all your PDFs, or the folder that holds them, together: the four SAT exports and your PAA export. They are sorted for you, read in this browser and never uploaded. The whole set can take 5 to 10 minutes; keep this tab open while it works.",
        )}
      </p>
      <div className={`drop-zone${over ? " over" : ""}`}>
        <p className="drop-title">{t("Drop PDFs here")}</p>
        <div className="drop-actions">
          <label className="file-button secondary">
            {t("Choose the PDFs")}
            <input
              aria-label={t("PDF export files")}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={running}
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <label className="file-button secondary">
            {t("Choose a folder")}
            <input
              aria-label={t("PDF folder")}
              type="file"
              // Takes every file in the folder and its subfolders; the PDFs are kept.
              {...{ webkitdirectory: "" }}
              disabled={running}
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <p className="small muted">
        {t(
          "SAT exports are recognised by name: read_write_active.pdf, read_write_inactive.pdf, math_active.pdf and math_inactive.pdf. Any other PDF is read as a PAA export, or set aside if it is not one.",
        )}
      </p>
      {files.length > 0 && (
        <ul className="pdf-add-files" aria-label={t("Chosen exports")}>
          {files.map((file) => (
            <li key={`${file.name}:${file.size}`}>
              <span>
                <code>{file.name}</code>{" "}
                <span className="small muted">{megabytes(file.size)}</span>
                <span className="small muted pdf-add-tag">{tag(file)}</span>
              </span>
              <button
                className="text-button"
                aria-label={t("Remove {name}", { name: file.name })}
                disabled={running}
                onClick={() =>
                  setFiles((current) => current.filter((f) => f !== file))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {notPdf.length > 0 && (
        <p className="small" role="status">
          {t("Ignored, because they are not PDFs: {files}", {
            files: notPdf.join(", "),
          })}
        </p>
      )}
      {satNames.length > 0 && !satReady && (
        <p className="small" role="status">
          {t("The SAT exports are read together. Still needed: {files}", {
            files: missing,
          })}
        </p>
      )}
      <details className="pdf-prepare-advanced">
        <summary>{t("Advanced")}</summary>
        <label className="small">
          {t("Reviewed exceptions (optional JSON file)")}{" "}
          <input
            aria-label={t("Reviewed exceptions")}
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
          disabled={!canStart}
          onClick={() => void start()}
        >
          {t("Add questions")}
        </button>
        {running ? (
          <button onClick={() => controller.current?.abort()}>
            {t("Cancel")}
          </button>
        ) : (
          <button onClick={() => close()}>{t("Close")}</button>
        )}
      </div>
      {running && progress && (
        <div className="pdf-prepare-progress">
          <progress
            aria-label={t("Progress")}
            max={progress.total}
            value={progress.done}
          />
          <p role="status">{progress.message}</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {outcomes.map((outcome) =>
        outcome.report ? (
          <PdfReport
            key={outcome.kind}
            kind={outcome.kind}
            report={outcome.report}
            unchanged={outcome.unchanged === true}
          />
        ) : (
          <p key={outcome.kind} role="alert">
            {outcome.error}
          </p>
        ),
      )}
    </dialog>
  );
}
