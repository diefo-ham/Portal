import { parseQuestions, mergeQuestions } from "./json";
import {
  assetKeys,
  writeAssets,
  readData,
  updateData,
} from "../storage/database";
import type { StudyData } from "../core/model";

/** Resolved against the page, so it works under a GitHub Pages subpath. */
const library = (path: string) =>
  `${import.meta.env.BASE_URL}local-library/${path}`;
let loading: Promise<StudyData> | undefined;
export function loadPreparedLibrary(progress: (message: string) => void) {
  return (loading ??= (async () => {
    const response = await fetch(library("manifest.json"), {
      cache: "no-store",
    });
    if (response.status === 404) return readData();
    if (!response.ok)
      throw new Error("Cannot read the prepared local question library.");
    const manifest = await response.json();
    if (
      manifest.format !== "sat-study-local-library-v1" ||
      !/^([a-f0-9]{64})$/.test(manifest.revision) ||
      !Array.isArray(manifest.assets) ||
      manifest.assets.some(
        (x: unknown) =>
          typeof x !== "string" || !/^([a-f0-9]{64})\.webp$/.test(x),
      )
    )
      throw new Error("Invalid local library manifest.");
    const id = "prepared:" + manifest.revision;
    const data = await readData();
    const present = await assetKeys();
    const missing = (manifest.assets as string[]).filter(
      (key) => !present.has(key),
    );
    if (data.imports.some((x) => x.id === id) && !missing.length) return data;
    progress("Reading your prepared PDF question library…");
    const questionResponse = await fetch(library("questions.json"));
    if (!questionResponse.ok)
      throw new Error("Prepared question data is missing.");
    const raw = await questionResponse.text();
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== manifest.revision)
      throw new Error(
        "Prepared library changed during import. Reload to retry.",
      );
    const incoming = parseQuestions(JSON.parse(raw));
    if (incoming.length !== manifest.questionCount)
      throw new Error("Prepared question count does not match its manifest.");
    const assetSet = new Set(manifest.assets);
    for (const q of incoming)
      for (const p of [
        ...(q.document?.question || []),
        ...(q.document?.rationale || []),
      ])
        if (!p.src.startsWith("asset:") || !assetSet.has(p.src.slice(6)))
          throw new Error("Question references an unlisted document image.");
    for (let i = 0; i < missing.length; i += 12) {
      progress(`Saving PDF images locally: ${i} / ${missing.length}…`);
      const entries = await Promise.all(
        missing.slice(i, i + 12).map(async (key: string) => {
          const r = await fetch(library("assets/" + key));
          if (!r.ok) throw new Error("A prepared PDF image is missing.");
          const blob = await r.blob();
          const digest = Array.from(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
            ),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
          if (digest + ".webp" !== key)
            throw new Error("A PDF image failed its integrity check.");
          return { key, blob };
        }),
      );
      await writeAssets(entries);
    }
    return updateData((d) => {
      if (d.imports.some((x) => x.id === id)) return;
      const result = mergeQuestions(
        d.questions,
        incoming,
        "College Board PDF exports",
      );
      // Prepared revisions may repair source layout/classification while stable IDs
      // preserve attempts, notes, bookmarks, and session membership.
      const revisions = new Map(
        incoming
          .filter((q) => q.source && q.sourceId)
          .map((q) => [q.source + "\u0000" + q.sourceId, q]),
      );
      const refreshed = result.questions.map((q) => {
        const replacement = revisions.get(q.source + "\u0000" + q.sourceId);
        return replacement
          ? { ...replacement, id: q.id, importMetadata: q.importMetadata }
          : q;
      });
      const prepared = (q: StudyData["questions"][number]) =>
        revisions.has(q.source + "\u0000" + q.sourceId);
      d.questions = [
        ...refreshed.filter(prepared),
        ...refreshed.filter((q) => !prepared(q)),
      ];
      d.imports.push({
        id,
        filename: manifest.label,
        importedAt: new Date().toISOString(),
        added: result.added,
        skipped: result.skipped,
      });
    });
  })().finally(() => {
    loading = undefined;
  }));
}
