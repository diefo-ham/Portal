import type { StudyData } from "../core/model";
import { assetKeys, writeAssets } from "../storage/database";

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
          "This file references PDF images this browser does not have. Embed the image data in the question JSON instead.",
        );
  }
  for (let i = 0; i < all.length; i += 32)
    await writeAssets(all.slice(i, i + 32));
  return normalized;
}
/** Every image a question still points at. Anything else in the image store is unused. */
export function referencedAssetKeys(data: StudyData): Set<string> {
  const keys = new Set<string>();
  for (const q of data.questions)
    for (const p of [
      ...(q.document?.question || []),
      ...(q.document?.rationale || []),
    ])
      if (p.src.startsWith("asset:")) keys.add(p.src.slice("asset:".length));
  return keys;
}
