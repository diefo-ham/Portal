/**
 * Browser entry for "prepare from PDF exports": reads the chosen PDFs, stores
 * the images, and imports the result through the same validation as any other
 * prepared library. Loaded lazily, because it brings the PDF reader with it.
 */
import { ingestLibrary, memorySource } from "../preparedLibrary.ts";
import { deleteAssetsExcept, writeAssets } from "../../storage/database.ts";
import { referencedAssetKeys } from "../documents.ts";
import type { ActiveSetting } from "./classify.ts";
import { encodeWebp, openExport } from "./pdfjsAdapter.ts";
import {
  assignExports,
  parseOverrides,
  prepareLibrary,
  type ExportName,
  type PrepareDeps,
  type PrepareReport,
  type PreparedLibrary,
  type Progress,
} from "./prepare.ts";
import { preparePaaLibrary } from "./preparePaa.ts";

export interface RunOptions {
  /** Defaults to reading the relationship from the files themselves. */
  mode?: ActiveSetting;
  /** Optional JSON file of reviewed exceptions. */
  overridesFile?: File;
  signal?: AbortSignal;
  progress?: (progress: Progress) => void;
}

const deps: PrepareDeps = {
  open: openExport,
  store: {
    async encode(image) {
      const blob = await encodeWebp(image);
      // WebP where the browser can write it, lossless PNG otherwise (Safari).
      if (blob.type !== "image/webp" && blob.type !== "image/png")
        throw new Error(
          "This browser cannot save the question images. Use a current Chrome, Edge, Firefox or Safari.",
        );
      return blob;
    },
    put: (key, blob) => writeAssets([{ key, blob }]),
  },
};

export async function prepareFromPdfs(files: File[], options: RunOptions) {
  const assigned = assignExports(files);
  if (assigned.missing.length)
    throw new Error(
      `Choose all four exports. Missing: ${assigned.missing.map((name) => name + ".pdf").join(", ")}.`,
    );
  const overrides = options.overridesFile
    ? parseOverrides(JSON.parse(await options.overridesFile.text()))
    : undefined;
  return adopt(
    await prepareLibrary(
      assigned.found as Record<ExportName, File>,
      {
        mode: options.mode,
        overrides,
        signal: options.signal,
        progress: options.progress,
      },
      deps,
    ),
    options,
  );
}

/** PAA exports: any number of PDFs, any file names, no active/inactive pairing. */
export async function prepareFromPaaPdfs(files: File[], options: RunOptions) {
  const overrides = options.overridesFile
    ? parseOverrides(JSON.parse(await options.overridesFile.text()))
    : undefined;
  return adopt(
    await preparePaaLibrary(
      files,
      { overrides, signal: options.signal, progress: options.progress },
      deps,
    ),
    options,
  );
}

async function adopt(prepared: PreparedLibrary, options: RunOptions) {
  const result = await ingestLibrary(
    memorySource(prepared.manifest, prepared.questionsJson),
    (message) =>
      options.progress?.({ phase: "finish", done: 0, total: 1, message }),
  );
  // Questions this replaced no longer need their old images.
  await deleteAssetsExcept(referencedAssetKeys(result.data));
  return { result, report: prepared.report as PrepareReport };
}
