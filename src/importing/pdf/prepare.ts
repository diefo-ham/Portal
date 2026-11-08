/**
 * What preparing a question library from PDFs shares across the three tests:
 * the shapes of a reader, its progress and report. The reading itself is `preparePaa.ts` (`prepareBankLibrary`
 * with one profile per test).
 */
import type { AccessCheck } from "./access.ts";
import type { PageLayout } from "./layout.ts";
import type { PanelRenderer, PanelStore } from "./panels.ts";
import type { ReviewedOverride } from "./record.ts";

export const PREPARE_FORMAT = "sat-study-local-library-v1";

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
  /** Checks a page's access code; by default against the portal's own hashes. */
  access?: AccessCheck;
}

export interface Progress {
  phase: "index" | "convert" | "finish";
  done: number;
  total: number;
  message: string;
}

export interface PrepareOptions {
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
  files: {
    filename: string;
    sha256: string;
    pages: number;
    questions: number;
  }[];
  /** PDFs that were chosen but are not question exports for this test, and so were set aside. */
  ignored?: string[];
  /** PDFs of the right test where no page carried its access code. */
  refused?: string[];
  /** Things worth a look that did not stop a question being imported (e.g. an item with no Source line). */
  warnings?: string[];
  quarantined: QuarantinedQuestion[];
  uniqueSourceIds: number;
  importedQuestions: number;
  counts: {
    section: Record<string, number>;
    testStatus: Record<string, number>;
    difficulty: Record<string, number>;
    /** TSI only: Official / Original, and the calculator tier of each question. */
    origin?: Record<string, number>;
    calculator?: Record<string, number>;
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
