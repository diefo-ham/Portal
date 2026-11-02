/**
 * Prepares a question library from the person's own four PDF exports, the same
 * library scripts/import_college_board.py writes: a manifest, one questions
 * document, and the question and explanation images. The PDF reader, image
 * encoder, and asset storage are injected so this orchestration is tested
 * without a browser.
 */
import { planCrops } from "./crops.ts";
import {
  classifyExports,
  type ActiveMode,
  type ActiveSetting,
} from "./classify.ts";
import type { PageLayout } from "./layout.ts";
import {
  buildPanels,
  sha256Hex,
  type Panel,
  type PanelRenderer,
  type PanelStore,
} from "./panels.ts";
import {
  convertRecordText,
  recordSignature,
  type ReviewedOverride,
} from "./record.ts";
import { indexExport, type SourceRecord } from "./segment.ts";

export const EXPORT_NAMES = [
  "read_write_inactive",
  "read_write_active",
  "math_inactive",
  "math_active",
] as const;
export type ExportName = (typeof EXPORT_NAMES)[number];

export const PREPARE_FORMAT = "sat-study-local-library-v1";
const PARSER = "college-board-pdf-browser-v1";

/** A chosen file: a browser `File` satisfies this. */
export interface ReadableFile {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** What the preparation needs from a PDF reader (see pdfjsAdapter.ts). */
export interface ExportReader {
  pageCount: number;
  layout(pageNumber: number): Promise<PageLayout>;
  renderer: PanelRenderer;
  close(): Promise<void>;
}

export interface PrepareDeps {
  open(data: Uint8Array): Promise<ExportReader>;
  store: PanelStore;
}

export interface Progress {
  phase: "index" | "convert" | "finish";
  done: number;
  total: number;
  message: string;
}

export interface PrepareOptions {
  /** How to read the active and inactive files; by default from their contents. */
  mode?: ActiveSetting;
  overrides?: Record<string, ReviewedOverride>;
  signal?: AbortSignal;
  progress?: (progress: Progress) => void;
}

export interface QuarantinedQuestion {
  sourceId: string;
  file: string;
  pages: number[];
  reason: string;
}

export interface PrepareReport {
  parser: string;
  createdAt: string;
  activeMode: ActiveSetting;
  /** How each subject's active and inactive files were read. */
  interpretation: Record<string, ActiveMode>;
  files: {
    filename: string;
    sha256: string;
    pages: number;
    questions: number;
  }[];
  comparison: ReturnType<typeof classifyExports>["comparison"];
  conflicts: ReturnType<typeof classifyExports>["conflicts"];
  quarantined: QuarantinedQuestion[];
  uniqueSourceIds: number;
  importedQuestions: number;
  counts: {
    section: Record<string, number>;
    testStatus: Record<string, number>;
    difficulty: Record<string, number>;
  };
}

export interface PreparedLibrary {
  manifest: {
    format: typeof PREPARE_FORMAT;
    revision: string;
    label: string;
    questionCount: number;
    assets: string[];
    summary: PrepareReport["counts"];
  };
  /** The exact text whose SHA-256 is the manifest revision. */
  questionsJson: string;
  report: PrepareReport;
}

/** Matches the four expected exports by file name, tolerating copies like "math_active (1).pdf". */
export function assignExports(files: readonly { name: string }[]) {
  const found: Partial<Record<ExportName, (typeof files)[number]>> = {};
  const unrecognized: string[] = [];
  for (const file of files) {
    const stem = file.name
      .toLowerCase()
      .replace(/\.pdf$/, "")
      .replace(/\s*\(\d+\)$/, "")
      .replace(/[\s-]+/g, "_");
    const name = EXPORT_NAMES.find((candidate) => candidate === stem);
    if (name && !found[name]) found[name] = file;
    else unrecognized.push(file.name);
  }
  return {
    found,
    unrecognized,
    missing: EXPORT_NAMES.filter((name) => !found[name]),
  };
}

/** Validates an optional file of reviewed exceptions, keyed by source ID. */
export function parseOverrides(raw: unknown): Record<string, ReviewedOverride> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "Reviewed exceptions must be a JSON object keyed by source ID.",
    );
  const result: Record<string, ReviewedOverride> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!/^[a-z0-9]{4,32}$/.test(id))
      throw new Error(`"${id.slice(0, 40)}" is not a valid source ID.`);
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new Error(`The exception for ${id} must be an object.`);
    const entry = value as Record<string, unknown>;
    const override: ReviewedOverride = {};
    if (entry.choiceLabelsVerified !== undefined) {
      if (typeof entry.choiceLabelsVerified !== "boolean")
        throw new Error(
          `choiceLabelsVerified for ${id} must be true or false.`,
        );
      override.choiceLabelsVerified = entry.choiceLabelsVerified;
    }
    if (entry.warning !== undefined) {
      if (typeof entry.warning !== "string" || entry.warning.length > 500)
        throw new Error(
          `The warning for ${id} must be text of at most 500 characters.`,
        );
      override.warning = entry.warning;
    }
    result[id] = override;
  }
  return result;
}

const tally = <T extends string>(values: readonly T[]) => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

interface Indexed {
  filename: string;
  sha256: string;
  pages: number;
  records: SourceRecord[];
}

export async function prepareLibrary(
  files: Record<ExportName, ReadableFile>,
  options: PrepareOptions,
  deps: PrepareDeps,
): Promise<PreparedLibrary> {
  const { signal, progress } = options;
  const overrides = options.overrides ?? {};
  const report = (update: Progress) => progress?.(update);
  const read = async (name: ExportName) =>
    new Uint8Array(await files[name].arrayBuffer());

  // Pass 1: read every export's text to learn which pages belong to which question.
  const indexed = {} as Record<ExportName, Indexed>;
  for (const [position, name] of EXPORT_NAMES.entries()) {
    signal?.throwIfAborted();
    const bytes = await read(name);
    const sha256 = await sha256Hex(bytes);
    const reader = await deps.open(bytes);
    try {
      const layouts: PageLayout[] = [];
      for (let page = 1; page <= reader.pageCount; page++) {
        signal?.throwIfAborted();
        layouts.push(await reader.layout(page));
        if (page % 25 === 0 || page === reader.pageCount)
          report({
            phase: "index",
            done: position * 100 + Math.round((page / reader.pageCount) * 100),
            total: EXPORT_NAMES.length * 100,
            message: `Reading ${files[name].name}: page ${page} of ${reader.pageCount}`,
          });
      }
      indexed[name] = {
        filename: files[name].name,
        sha256,
        pages: reader.pageCount,
        records: indexExport(files[name].name, layouts),
      };
    } finally {
      await reader.close();
    }
  }

  const classification = classifyExports(
    [
      {
        group: "read_write",
        inactive: indexed.read_write_inactive.records,
        active: indexed.read_write_active.records,
      },
      {
        group: "math",
        inactive: indexed.math_inactive.records,
        active: indexed.math_active.records,
      },
    ],
    options.mode ?? "auto",
  );

  // Source IDs, not page numbers or fuzzy text, establish identity.
  const collected = new Map<
    string,
    { name: ExportName; record: SourceRecord }[]
  >();
  for (const name of EXPORT_NAMES)
    for (const record of indexed[name].records) {
      const list = collected.get(record.id) ?? [];
      list.push({ name, record });
      collected.set(record.id, list);
    }
  const quarantined: QuarantinedQuestion[] = [];
  const questions: Record<string, unknown>[] = [];
  const usedAssets = new Set<string>();
  const total = collected.size;
  let handled = 0;

  // Pass 2: convert each question from the first export it appears in.
  for (const name of EXPORT_NAMES) {
    const mine = [...collected.entries()].filter(
      ([, occurrences]) => occurrences[0].name === name,
    );
    if (!mine.length) continue;
    const reader = await deps.open(await read(name));
    try {
      for (const [id, occurrences] of mine) {
        signal?.throwIfAborted();
        const { record } = occurrences[0];
        try {
          if (
            new Set(occurrences.map((o) => recordSignature(o.record))).size > 1
          )
            throw new Error(
              "Same source ID has conflicting metadata or answer keys",
            );
          const text = convertRecordText(record, overrides[id]);
          const layouts: PageLayout[] = [];
          for (const page of record.pages)
            layouts.push(await reader.layout(page));
          const plans = planCrops(record, layouts);
          const panels = await buildPanels(plans, reader.renderer, deps.store);
          for (const panel of [...panels.question, ...panels.rationale])
            usedAssets.add(panel.src.slice("asset:".length));
          questions.push(
            assemble(
              text,
              panels,
              classification.statuses.get(id) ?? "unknown",
              occurrences,
              indexed,
              files,
            ),
          );
        } catch (error) {
          if (signal?.aborted) throw error;
          quarantined.push({
            sourceId: id,
            file: indexed[name].filename,
            pages: record.pages,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        handled++;
        if (handled % 10 === 0 || handled === total)
          report({
            phase: "convert",
            done: handled,
            total,
            message: `Preparing questions: ${handled} of ${total}`,
          });
      }
    } finally {
      await reader.close();
    }
  }
  if (!questions.length)
    throw new Error(
      "No question could be prepared. Check that these are the supported exports; the report lists the reasons.",
    );

  report({
    phase: "finish",
    done: 1,
    total: 1,
    message: "Checking the prepared library…",
  });
  const questionsJson = JSON.stringify({ schemaVersion: 1, questions });
  const counts = {
    section: tally(questions.map((q) => String(q.section))),
    testStatus: tally(questions.map((q) => String(q.testStatus))),
    difficulty: tally(questions.map((q) => String(q.difficulty))),
  };
  return {
    manifest: {
      format: PREPARE_FORMAT,
      revision: await sha256Hex(new TextEncoder().encode(questionsJson)),
      label: "PDF exports prepared in the browser",
      questionCount: questions.length,
      assets: [...usedAssets].sort(),
      summary: counts,
    },
    questionsJson,
    report: {
      parser: PARSER,
      createdAt: new Date().toISOString(),
      activeMode: options.mode ?? "auto",
      interpretation: classification.interpretation,
      files: EXPORT_NAMES.map((name) => ({
        filename: indexed[name].filename,
        sha256: indexed[name].sha256,
        pages: indexed[name].pages,
        questions: indexed[name].records.length,
      })),
      comparison: classification.comparison,
      conflicts: classification.conflicts,
      quarantined,
      uniqueSourceIds: collected.size,
      importedQuestions: questions.length,
      counts,
    },
  };
}

function assemble(
  text: ReturnType<typeof convertRecordText>,
  panels: { question: Panel[]; rationale: Panel[] },
  testStatus: string,
  occurrences: { name: ExportName; record: SourceRecord }[],
  indexed: Record<ExportName, Indexed>,
  files: Record<ExportName, ReadableFile>,
): Record<string, unknown> {
  const { choices, extractionWarnings, answerKeyOrigin, ...rest } = text;
  return {
    ...rest,
    testStatus,
    document: {
      question: panels.question,
      rationale: panels.rationale,
      textIsApproximate: true,
      answerKeyOrigin,
      provenance: occurrences.map(({ name, record }) => ({
        filename: files[name].name,
        sha256: indexed[name].sha256,
        pages: record.pages,
      })),
      ...(extractionWarnings ? { extractionWarnings } : {}),
    },
    ...(choices ? { choices } : {}),
  };
}
