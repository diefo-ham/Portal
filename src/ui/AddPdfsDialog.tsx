import { useEffect, useRef, useState } from "react";
import type { PrepareReport, Progress } from "../importing/pdf/prepare";
import { readDrop } from "./droppedFiles";
import { useAssessment, useT } from "./i18n";
import { PdfReport } from "./PdfReport";
import { containsTarget } from "@/src/utils/dom";

export type PrepareFiles = (
  files: File[],
  options: {
    overridesFile?: File;
    signal: AbortSignal;
    progress: (progress: Progress) => void;
  },
) => Promise<{ report: PrepareReport; result?: { unchanged: boolean } }>;

export type AddPdfsDialogProps = {
  open: boolean;
  onClose: () => void;
  /** SAT question PDF(s): one file holds both tests and the ACTIVE / INACTIVE badges. */
  prepareSat: PrepareFiles;
  /** PAA question PDF(s), any file names. */
  preparePaa: PrepareFiles;
  /** TSIA2 question PDF(s), any file names. */
  prepareTsi: PrepareFiles;
  /**
   * Which test a PDF holds questions for, from the Assessment column of its
   * first pages; undefined when it is none of the three.
   */
  detect: (file: File) => Promise<Kind | undefined>;
};

export type Kind = "SAT" | "PAA" | "TSI";

interface Outcome {
  kind: Kind;
  report?: PrepareReport;
  unchanged?: boolean;
  error?: string;
}

const fileKey = (file: File) => `${file.name}:${file.size}`;

const isPdf = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

const megabytes = (bytes: number) =>
  bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

/**
 * Drop the PDFs here, with any file names. Each is sorted by the test named
 * inside it (SAT, PAA or TSIA2), and anything that is none of them is set
 * aside. Nothing is guessed from file names. Every page must carry the access
 * code for its test, which the reader checks.
 */
export const AddPdfsDialog = ({ open, ...rest }: AddPdfsDialogProps) => {
  // Mounted only while open: every opening starts clean, and a closed dialog
  // leaves nothing in the page for screen readers or other dialogs to meet.
  return open ? <OpenDialog {...rest} /> : null;
};

function OpenDialog({
  onClose,
  prepareSat,
  preparePaa,
  prepareTsi,
  detect,
}: Omit<AddPdfsDialogProps, "open">) {
  const t = useT();
  const assessment = useAssessment();
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
  const [kinds, setKinds] = useState<
    Record<string, Kind | "unknown" | "checking">
  >({});
  // Each PDF is read once in full to see which test it is for. One at a time:
  // the SAT file alone can be hundreds of megabytes.
  const looking = useRef<Promise<void>>(Promise.resolve());

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

  const ofKind = (kind: Kind) =>
    files.filter((file) => kinds[fileKey(file)] === kind);
  const satFiles = ofKind("SAT");
  const paaFiles = ofKind("PAA");
  const tsiFiles = ofKind("TSI");
  const checking = files.some((file) => kinds[fileKey(file)] === "checking");
  const canStart =
    (satFiles.length > 0 || paaFiles.length > 0 || tsiFiles.length > 0) &&
    !running &&
    !checking;

  const add = (incoming: File[]) => {
    if (running || !incoming.length) return;
    const pdfs = incoming.filter(isPdf);
    setNotPdf(incoming.filter((file) => !isPdf(file)).map((file) => file.name));
    setOutcomes([]);
    setError("");
    const fresh = pdfs.filter(
      (file) =>
        !files.some(
          (known) => known.name === file.name && known.size === file.size,
        ),
    );
    setFiles((current) => [
      ...current,
      ...fresh.filter(
        (file) => !current.some((known) => fileKey(known) === fileKey(file)),
      ),
    ]);
    // Each PDF is looked at to see which test it is for.
    for (const file of fresh) {
      const key = fileKey(file);
      setKinds((current) => ({ ...current, [key]: "checking" }));
      looking.current = looking.current.then(() =>
        detect(file).then(
          (kind) =>
            setKinds((current) => ({ ...current, [key]: kind ?? "unknown" })),
          () => setKinds((current) => ({ ...current, [key]: "unknown" })),
        ),
      );
    }
  };

  const start = async () => {
    const jobs: { kind: Kind; files: File[]; run: PrepareFiles }[] = [];
    if (satFiles.length)
      jobs.push({ kind: "SAT", files: satFiles, run: prepareSat });
    if (paaFiles.length)
      jobs.push({ kind: "PAA", files: paaFiles, run: preparePaa });
    if (tsiFiles.length)
      jobs.push({ kind: "TSI", files: tsiFiles, run: prepareTsi });
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
        .flatMap(
          (outcome) =>
            ({ SAT: satFiles, PAA: paaFiles, TSI: tsiFiles })[outcome.kind],
        ),
    );
    setFiles((current) => current.filter((file) => !added.has(file)));
  };

  const tag = (file: File) => {
    const kind = kinds[fileKey(file)];
    if (kind === "SAT") return t("SAT questions");
    if (kind === "PAA") return t("PAA questions");
    if (kind === "TSI") return t("TSI questions");
    if (kind === "unknown")
      return t("Not an SAT, PAA or TSI question PDF: it will be set aside");
    return t("Checking…");
  };

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
        if (!containsTarget(event.currentTarget, event.relatedTarget))
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
          "Drop your SAT, PAA and TSI question PDFs, or the folder that holds them, together or one at a time. They are sorted for you, read in this browser and never uploaded. The SAT PDF is large and can take 10 minutes or more; keep this tab open while it works.",
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
        </div>
      </div>
      <p className="small muted">
        {t(
          "File names do not matter. Each PDF is sorted by the test named inside it, and only pages that carry the access code for that test are added.",
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
      {outcomes.map((outcome) => (
        <section key={outcome.kind} className="pdf-outcome">
          <h3>{outcome.kind}</h3>
          {outcome.report ? (
            <>
              <PdfReport
                kind={outcome.kind}
                report={outcome.report}
                unchanged={outcome.unchanged === true}
              />
              {outcome.kind !== assessment && (
                <p className="small muted">
                  {t(
                    "These are {test} questions. Use the switch at the top to open them.",
                    { test: outcome.kind },
                  )}
                </p>
              )}
            </>
          ) : (
            <p role="alert">{outcome.error}</p>
          )}
        </section>
      ))}
    </dialog>
  );
}
