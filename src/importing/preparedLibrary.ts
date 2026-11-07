import { parseQuestions, mergeQuestions } from "./json";
import {
  assetKeys,
  writeAssets,
  readData,
  updateData,
} from "../storage/database";
import { assessmentOf, type StudyData } from "../core/model";
import { EXAMPLES_OFF_KEY, EXAMPLES_PATH } from "../core/bundled";
import { readStorage } from "../utils/storage";

/** One key for "the same source question", which never crosses assessments. */
const sourceKey = (q: StudyData["questions"][number]) =>
  [assessmentOf(q), q.source, q.sourceId].join("\u0000");

/** Receipt id prefixes in `imports`: the person's own libraries, and the bundled examples. */
export const PREPARED_RECEIPT = "prepared:";
export const EXAMPLES_RECEIPT = "examples:";

/** Source label of the original example questions older versions offered. */
const EXAMPLE_SOURCE = "Original synthetic examples";

/**
 * Where a prepared library (manifest.json, questions.json, assets/*.webp) is
 * read from: the local server, or one prepared in memory from PDF exports.
 */
export interface LibrarySource {
  /** Undefined means that no library is available from this source. */
  manifest(): Promise<unknown | undefined>;
  questions(): Promise<string>;
  asset(key: string): Promise<Blob>;
}

/** Resolved against the page, so it works under a GitHub Pages subpath. */
const library = (path: string) =>
  `${import.meta.env.BASE_URL}local-library/${path}`;

/** A library served as static files under `base` (manifest.json, questions.json, assets/). */
const staticSource = (
  base: (path: string) => string,
  what: string,
): LibrarySource => ({
  async manifest() {
    const response = await fetch(base("manifest.json"), {
      cache: "no-store",
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Cannot read the ${what}.`);
    return response.json();
  },
  async questions() {
    const response = await fetch(base("questions.json"));
    if (!response.ok) throw new Error("Prepared question data is missing.");
    return response.text();
  },
  async asset(key) {
    const response = await fetch(base("assets/" + key));
    if (!response.ok) throw new Error("A prepared PDF image is missing.");
    return response.blob();
  },
});

const serverSource = staticSource(library, "prepared local question library");

const examplesSource = staticSource(
  (path) => `${import.meta.env.BASE_URL}${EXAMPLES_PATH}${path}`,
  "bundled example questions",
);

/**
 * A library prepared in memory. Its images were already stored under their
 * content hashes, so asking for one here means something went wrong.
 */
export function memorySource(
  manifest: unknown,
  questionsJson: string,
): LibrarySource {
  return {
    manifest: async () => manifest,
    questions: async () => questionsJson,
    asset: async () => {
      throw new Error("A prepared PDF image is missing.");
    },
  };
}

const sha256 = async (bytes: BufferSource) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");

export interface LibraryResult {
  data: StudyData;
  /** Questions listed by the library, or 0 when the source has no library. */
  questionCount: number;
  /** True when this exact library revision was already imported. */
  unchanged: boolean;
}

/** Validates every byte of an untrusted library before it enters storage. */
export async function ingestLibrary(
  source: LibrarySource,
  progress: (message: string) => void,
  /** Prefix of the receipt kept in `imports`; the examples use their own. */
  receipt: string = PREPARED_RECEIPT,
): Promise<LibraryResult> {
  const manifest = (await source.manifest()) as
    Record<string, unknown> | undefined;
  if (manifest === undefined)
    return { data: await readData(), questionCount: 0, unchanged: true };
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    manifest.format !== "sat-study-local-library-v1" ||
    typeof manifest.revision !== "string" ||
    !/^([a-f0-9]{64})$/.test(manifest.revision) ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.some(
      (x: unknown) =>
        typeof x !== "string" || !/^([a-f0-9]{64})\.(webp|png)$/.test(x),
    ) ||
    !Number.isInteger(manifest.questionCount)
  )
    throw new Error("Invalid local library manifest.");
  const assetList = manifest.assets as string[];
  const label =
    typeof manifest.label === "string" ? manifest.label.slice(0, 120) : "";
  const questionCount = manifest.questionCount as number;
  const id = receipt + manifest.revision;
  const data = await readData();
  const present = await assetKeys();
  const missing = assetList.filter((key) => !present.has(key));
  if (data.imports.some((x) => x.id === id) && !missing.length)
    return { data, questionCount, unchanged: true };
  progress("Reading your prepared PDF question library…");
  const raw = await source.questions();
  const hash = await sha256(new TextEncoder().encode(raw));
  if (hash !== manifest.revision)
    throw new Error("Prepared library changed during import. Reload to retry.");
  const incoming = parseQuestions(JSON.parse(raw));
  if (incoming.length !== questionCount)
    throw new Error("Prepared question count does not match its manifest.");
  const assetSet = new Set(assetList);
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
        const blob = await source.asset(key);
        if ((await sha256(await blob.arrayBuffer())) + key.slice(64) !== key)
          throw new Error("A PDF image failed its integrity check.");
        return { key, blob };
      }),
    );
    await writeAssets(entries);
  }
  const updated = await updateData((d) => {
    if (d.imports.some((x) => x.id === id)) return;
    // A question is never stored twice: one test's source ID is one question.
    // A real (imported) question replaces a bundled example with the same ID, and
    // an example is not added where a real question already has it. Identity is
    // by ID only, never by similar wording.
    const idOf = (q: StudyData["questions"][number]) =>
      [assessmentOf(q), q.sourceId ?? ""].join("\u0000");
    const hasId = (q: StudyData["questions"][number]) => !!q.sourceId;
    const realIds = new Set(
      [...d.questions, ...incoming]
        .filter((q) => q.bundled !== true && hasId(q))
        .map(idOf),
    );
    const replaced = new Set(
      d.questions
        .filter((q) => q.bundled === true && hasId(q) && realIds.has(idOf(q)))
        .map((q) => q.id),
    );
    if (replaced.size) {
      d.questions = d.questions.filter((q) => !replaced.has(q.id));
      // A session that used a replaced example ends; its answers stay.
      const ended = new Set(
        d.sessions
          .filter((s) => s.questionIds.some((qid) => replaced.has(qid)))
          .map((s) => s.id),
      );
      d.sessions = d.sessions.filter((s) => !ended.has(s.id));
      for (const attempt of d.attempts)
        if (attempt.sessionId && ended.has(attempt.sessionId))
          delete attempt.sessionId;
    }
    const candidates = incoming.filter(
      (q) => q.bundled !== true || !hasId(q) || !realIds.has(idOf(q)),
    );
    const result = mergeQuestions(
      d.questions,
      candidates,
      label || "PDF question library",
    );
    // Prepared revisions may repair source layout/classification while stable IDs
    // preserve attempts, notes, bookmarks, and session membership.
    const revisions = new Map(
      candidates
        .filter((q) => q.source && q.sourceId)
        .map((q) => [sourceKey(q), q]),
    );
    const refreshed = result.questions.map((q) => {
      const replacement = revisions.get(sourceKey(q));
      return replacement
        ? { ...replacement, id: q.id, importMetadata: q.importMetadata }
        : q;
    });
    const prepared = (q: StudyData["questions"][number]) =>
      revisions.has(sourceKey(q));
    // Example questions from earlier visits are not wanted beside real ones,
    // unless the person has already worked on them.
    const worked = new Set([
      ...d.attempts.map((a) => a.questionId),
      ...Object.keys(d.annotations),
    ]);
    const leftover = (q: StudyData["questions"][number]) =>
      !prepared(q) && !(q.source === EXAMPLE_SOURCE && !worked.has(q.id));
    d.questions = [
      ...refreshed.filter(prepared),
      ...refreshed.filter(leftover),
    ];
    d.imports.push({
      id,
      filename: label || "Prepared library",
      importedAt: new Date().toISOString(),
      added: result.added,
      skipped: result.skipped,
    });
  });
  return { data: updated, questionCount, unchanged: false };
}

let loading: Promise<StudyData> | undefined;
/** Loads the library the local server offers, if any. Hosted sites have none. */
export function loadPreparedLibrary(progress: (message: string) => void) {
  return (loading ??= ingestLibrary(serverSource, progress)
    .then((result) => result.data)
    .finally(() => {
      loading = undefined;
    }));
}

let loadingExamples: Promise<StudyData> | undefined;
/**
 * Adds the bundled example questions (`public/examples/`) once per revision.
 * They never stop the app from opening: if they cannot be read (offline before
 * the first copy, a damaged file), the study data is returned as it is and the
 * next load tries again.
 */
export function loadBundledExamples(progress: (message: string) => void) {
  if (readStorage(EXAMPLES_OFF_KEY) === "off") return readData();
  return (loadingExamples ??= ingestLibrary(
    examplesSource,
    progress,
    EXAMPLES_RECEIPT,
  )
    .then((result) => result.data)
    .catch(() => readData())
    .finally(() => {
      loadingExamples = undefined;
    }));
}
