/**
 * Browser entry for "prepare from PDF exports": reads the chosen PDFs, stores
 * the images, and imports the result through the same validation as any other
 * prepared library. Loaded lazily, because it brings the PDF reader with it.
 */
import { ingestLibrary, memorySource } from "../preparedLibrary.ts";
import { writeAssets } from "../../storage/database.ts";
import type { ActiveMode } from "./classify.ts";
import { encodeWebp, openExport } from "./pdfjsAdapter.ts";
import {
  assignExports,
  parseOverrides,
  prepareLibrary,
  type ExportName,
  type PrepareReport,
  type Progress,
} from "./prepare.ts";

export interface RunOptions {
  mode: ActiveMode;
  /** Optional JSON file of reviewed exceptions. */
  overridesFile?: File;
  signal?: AbortSignal;
  progress?: (progress: Progress) => void;
}

export async function prepareFromPdfs(files: File[], options: RunOptions) {
  const assigned = assignExports(files);
  if (assigned.missing.length)
    throw new Error(
      `Choose all four exports. Missing: ${assigned.missing.map((name) => name + ".pdf").join(", ")}.`,
    );
  const overrides = options.overridesFile
    ? parseOverrides(JSON.parse(await options.overridesFile.text()))
    : undefined;
  const prepared = await prepareLibrary(
    assigned.found as Record<ExportName, File>,
    {
      mode: options.mode,
      overrides,
      signal: options.signal,
      progress: options.progress,
    },
    {
      open: openExport,
      store: {
        async encode(image) {
          const blob = await encodeWebp(image);
          if (blob.type !== "image/webp")
            throw new Error(
              "This browser cannot save images as WebP. Use a current Chrome, Edge, or Firefox.",
            );
          return blob;
        },
        put: (key, blob) => writeAssets([{ key, blob }]),
      },
    },
  );
  const result = await ingestLibrary(
    memorySource(prepared.manifest, prepared.questionsJson),
    (message) =>
      options.progress?.({ phase: "finish", done: 0, total: 1, message }),
  );
  return { result, report: prepared.report as PrepareReport };
}
