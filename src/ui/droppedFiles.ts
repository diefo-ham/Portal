/**
 * Files from a drop that may include folders. Browsers hand a dropped folder
 * over as a directory entry, not as files, so it is walked here, including
 * subfolders. Everything is read locally; nothing is fetched.
 */

/** The parts of a browser file-system entry this needs (the real ones satisfy it). */
export interface DroppedEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(
    success: (file: File) => void,
    failure?: (error: unknown) => void,
  ): void;
  createReader?(): {
    readEntries(
      success: (entries: DroppedEntry[]) => void,
      failure?: (error: unknown) => void,
    ): void;
  };
}

/** Deep enough for any real export folder, shallow enough to stop a loop of links. */
const MAX_DEPTH = 8;

async function walk(
  entry: DroppedEntry,
  depth: number,
  out: File[],
): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = entry.file.bind(entry);
    out.push(
      await new Promise<File>((resolve, reject) => file(resolve, reject)),
    );
  } else if (entry.isDirectory && entry.createReader && depth < MAX_DEPTH) {
    const reader = entry.createReader();
    // A directory is read in batches; an empty batch means it is finished.
    for (;;) {
      const batch = await new Promise<DroppedEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!batch.length) break;
      for (const child of batch) await walk(child, depth + 1, out);
    }
  }
}

/** Every file in the dropped entries, folders included, in the order dropped. */
export async function filesFromEntries(
  entries: readonly (DroppedEntry | null)[],
): Promise<File[]> {
  const files: File[] = [];
  for (const entry of entries) if (entry) await walk(entry, 0, files);
  return files;
}

/**
 * Reads a drop. Entries must be taken synchronously inside the drop handler (the
 * browser empties them afterwards), so this is called there; folders are walked
 * and plain files are used as they are.
 */
export function readDrop(transfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(transfer.items ?? []).map((item) =>
    item.kind === "file"
      ? ((item.webkitGetAsEntry?.() as DroppedEntry | null | undefined) ?? null)
      : null,
  );
  const plain = Array.from(transfer.files);
  return entries.some((entry) => entry?.isDirectory)
    ? filesFromEntries(entries)
    : Promise.resolve(plain);
}
