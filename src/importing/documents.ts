import type { StudyData } from "../core/model";
import type { BackupPreferences } from "./backup";
import { assetKeys, readAsset, writeAssets } from "../storage/database";

export async function storeInlineDocuments(
  data: StudyData,
): Promise<StudyData> {
  const normalized = structuredClone(data);
  const entries = new Map<string, Blob>();
  const references = new Set<string>();
  for (const q of normalized.questions)
    for (const p of [
      ...(q.document?.question || []),
      ...(q.document?.rationale || []),
    ]) {
      if (!p.src.startsWith("data:")) {
        references.add(p.src.slice(6));
        continue;
      }
      const blob = await (await fetch(p.src)).blob();
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const key = hash + ".webp";
      entries.set(key, blob);
      p.src = "asset:" + key;
    }
  const all = [...entries].map(([key, blob]) => ({ key, blob }));
  if (references.size) {
    const existing = await assetKeys();
    for (const key of references)
      if (!existing.has(key) && !entries.has(key))
        throw new Error(
          "This file references unavailable PDF images. Use a full portable backup or embed the image data in the question JSON.",
        );
  }
  for (let i = 0; i < all.length; i += 32)
    await writeAssets(all.slice(i, i + 32));
  return normalized;
}
function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
/** Include image content in backups; references alone cannot make portable backups. */
export async function portableBackup(
  data: StudyData,
  preferences?: BackupPreferences,
) {
  const copy = structuredClone(data);
  const urls = new Map<string, string>();
  for (const q of copy.questions)
    for (const p of [
      ...(q.document?.question || []),
      ...(q.document?.rationale || []),
    ]) {
      if (!p.src.startsWith("asset:")) continue;
      const key = p.src.slice(6);
      if (!urls.has(key)) {
        const blob = await readAsset(key);
        if (!blob)
          throw new Error(
            `Missing document image ${key}. Reopen the prepared local library before exporting.`,
          );
        urls.set(key, await asDataUrl(blob));
      }
      p.src = urls.get(key)!;
    }
  return {
    format: "sat-study-backup-v1",
    exportedAt: new Date().toISOString(),
    ...(preferences ? { preferences } : {}),
    data: copy,
  };
}
