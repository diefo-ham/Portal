/**
 * Prepares a PAA question library from the person's own PDF export(s). The
 * result has the same shape as the SAT library (manifest, questions document,
 * images), so it goes through the same validation and storage. Unlike the SAT
 * export there is no active/inactive pairing and no required file names: any
 * number of PDFs is accepted, and a question ID seen twice must agree with
 * itself or the question is left out.
 */
import { planCrops } from "./crops.ts";
import {
  convertPaaRecord,
  groupPassages,
  indexPaaExport,
  isPaaQuestionPage,
  isPaaRecord,
  paaSignature,
  peekAssessment,
  type PaaRecord,
  type PassageGroup,
} from "./paa.ts";
import type { ReviewedOverride } from "./record.ts";
import {
  CALCULATOR_TAG_PHRASES,
  convertTsiRecord,
  groupTsiPassages,
  isTsiRecord,
  tsiSignature,
} from "./tsi.ts";
import type { PageLayout } from "./layout.ts";
import { buildPanels, sha256Hex } from "./panels.ts";
import {
  PREPARE_FORMAT,
  type PrepareDeps,
  type PrepareOptions,
  type PrepareReport,
  type PreparedLibrary,
  type QuarantinedQuestion,
  type ReadableFile,
} from "./prepare.ts";

/**
 * What differs between exports that share the Educator Question Bank layout:
 * who they are for, how a page becomes a question, and what is said to the
 * person (the PAA's messages are Spanish, the TSI's English).
 */
export interface BankProfile {
  parser: string;
  label: string;
  /** Internal ids are `${idPrefix}${source id}`. */
  idPrefix: string;
  language: "en" | "es";
  /** Whether a page's Assessment column names this test. */
  accepts(record: PaaRecord): boolean;
  group(records: readonly PaaRecord[]): Map<string, PassageGroup>;
  signature(record: PaaRecord): string;
  /** Text fields of one question, plus short notes for the import report. */
  convert(
    record: PaaRecord,
    group: PassageGroup | undefined,
    override: ReviewedOverride | undefined,
  ): { text: Record<string, unknown>; notes: string[] };
  /** Phrases painted over in question images. */
  maskPhrases?: readonly string[];
  say: {
    reading(file: string, page: number, pages: number): string;
    converting(done: number, total: number): string;
    checking: string;
    noneQualified(ignored: string[]): string;
    nothingPrepared(firstProblem: string | undefined): string;
  };
}

export const PAA_PROFILE: BankProfile = {
  parser: "paa-pdf-browser-v1",
  label: "PAA: preguntas preparadas desde PDF",
  idPrefix: "paa-",
  language: "es",
  accepts: isPaaRecord,
  group: (records) => groupPassages(records),
  signature: paaSignature,
  convert: (record, group, override) => ({
    text: convertPaaRecord(record, group, override) as unknown as Record<
      string,
      unknown
    >,
    notes: [],
  }),
  say: {
    reading: (file, page, pages) =>
      `Leyendo ${file}: página ${page} de ${pages}`,
    converting: (done, total) => `Preparando preguntas: ${done} de ${total}`,
    checking: "Comprobando la biblioteca preparada…",
    noneQualified: (ignored) =>
      `Ninguno de los PDF es una exportación de preguntas de la PAA, así que no se agregó nada. Se ignoraron: ${ignored.join(", ")}.`,
    nothingPrepared: (first) =>
      "No se pudo preparar ninguna pregunta. Comprueba que sean exportaciones de preguntas de la PAA." +
      (first ? ` Primer problema: ${first}` : ""),
  },
};

export const TSI_PROFILE: BankProfile = {
  parser: "tsi-pdf-browser-v1",
  label: "TSI: questions prepared from PDF",
  idPrefix: "tsi-",
  language: "en",
  accepts: isTsiRecord,
  group: groupTsiPassages,
  signature: tsiSignature,
  convert: (record, group, override) => {
    const { text, notes } = convertTsiRecord(record, group, override);
    return { text: text as unknown as Record<string, unknown>, notes };
  },
  maskPhrases: CALCULATOR_TAG_PHRASES,
  say: {
    reading: (file, page, pages) => `Reading ${file}: page ${page} of ${pages}`,
    converting: (done, total) => `Preparing questions: ${done} of ${total}`,
    checking: "Checking the prepared library…",
    noneQualified: (ignored) =>
      `None of the PDFs is a TSIA2 question export, so nothing was added. Set aside: ${ignored.join(", ")}.`,
    nothingPrepared: (first) =>
      "No question could be prepared. Check that these are TSIA2 question exports." +
      (first ? ` First problem: ${first}` : ""),
  },
};

const tally = (values: readonly string[]) => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

interface Indexed {
  file: ReadableFile;
  sha256: string;
  pages: number;
  records: PaaRecord[];
}

export const preparePaaLibrary = (
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
) => prepareBankLibrary(chosen, options, deps, PAA_PROFILE);

export const prepareTsiLibrary = (
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
) => prepareBankLibrary(chosen, options, deps, TSI_PROFILE);

export async function prepareBankLibrary(
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
  profile: BankProfile,
): Promise<PreparedLibrary> {
  const { signal, progress } = options;
  const overrides = options.overrides ?? {};
  // A fixed order keeps the library revision the same for the same PDFs.
  const files = [...chosen].sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) throw new Error("Choose at least one PDF.");

  const indexed: Indexed[] = [];
  // A chosen PDF that is not an export of PAA questions (a letter, a study guide,
  // an SAT export) is set aside instead of stopping the others.
  const ignored: string[] = [];
  for (const [position, file] of files.entries()) {
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const reader = await deps.open(bytes);
    try {
      // The first pages of an export are questions: look there before reading them all.
      let looksRight = false;
      for (
        let page = 1;
        page <= Math.min(3, reader.pageCount) && !looksRight;
        page++
      ) {
        const layout = await reader.layout(page);
        // Question pages whose Assessment column names another test are not ours.
        looksRight =
          isPaaQuestionPage(layout) &&
          profile.accepts({ assessment: peekAssessment(layout) } as PaaRecord);
      }
      if (!looksRight) {
        ignored.push(file.name);
        continue;
      }
      const layouts: PageLayout[] = [];
      for (let page = 1; page <= reader.pageCount; page++) {
        signal?.throwIfAborted();
        layouts.push(await reader.layout(page));
        if (page % 25 === 0 || page === reader.pageCount)
          progress?.({
            phase: "index",
            done: position * 100 + Math.round((page / reader.pageCount) * 100),
            total: files.length * 100,
            message: profile.say.reading(file.name, page, reader.pageCount),
          });
      }
      const records = indexPaaExport(file.name, layouts);
      if (!records.some(profile.accepts)) {
        ignored.push(file.name);
        continue;
      }
      indexed.push({ file, sha256, pages: reader.pageCount, records });
    } finally {
      await reader.close();
    }
  }
  if (!indexed.length) throw new Error(profile.say.noneQualified(ignored));

  // The ID printed on the page establishes identity; the first copy is used.
  const collected = new Map<string, { at: Indexed; record: PaaRecord }[]>();
  for (const at of indexed)
    for (const record of at.records) {
      const list = collected.get(record.id) ?? [];
      list.push({ at, record });
      collected.set(record.id, list);
    }
  const ordered = [...collected.values()].map((list) => list[0].record);
  const groups = profile.group(ordered);

  const quarantined: QuarantinedQuestion[] = [];
  const warnings: string[] = [];
  const questions: Record<string, unknown>[] = [];
  const usedAssets = new Set<string>();
  const total = collected.size;
  let handled = 0;
  for (const at of indexed) {
    const mine = [...collected.entries()].filter(
      ([, list]) => list[0].at === at,
    );
    if (!mine.length) continue;
    const reader = await deps.open(new Uint8Array(await at.file.arrayBuffer()));
    try {
      for (const [id, list] of mine) {
        signal?.throwIfAborted();
        const { record } = list[0];
        try {
          if (new Set(list.map((o) => profile.signature(o.record))).size > 1)
            throw new Error(
              "Same source ID has conflicting metadata or answer keys",
            );
          const { text, notes } = profile.convert(
            record,
            groups.get(id),
            overrides[id],
          );
          for (const note of notes) warnings.push(`${id}: ${note}`);
          const layouts: PageLayout[] = [];
          for (const page of record.pages)
            layouts.push(await reader.layout(page));
          const plans = planCrops(record, layouts, profile.language, {
            maskPhrases: profile.maskPhrases,
          });
          const panels = await buildPanels(plans, reader.renderer, deps.store);
          for (const panel of [...panels.question, ...panels.rationale])
            usedAssets.add(panel.src.slice("asset:".length));
          const { choices, extractionWarnings, answerKeyOrigin, ...rest } =
            text;
          questions.push({
            ...rest,
            // There is no active/inactive concept in the PAA.
            testStatus: "unknown",
            document: {
              question: panels.question,
              rationale: panels.rationale,
              textIsApproximate: true,
              answerKeyOrigin,
              provenance: list.map((o) => ({
                filename: o.at.file.name,
                sha256: o.at.sha256,
                pages: o.record.pages,
              })),
              ...(extractionWarnings ? { extractionWarnings } : {}),
            },
            ...(choices ? { choices } : {}),
          });
        } catch (error) {
          if (signal?.aborted) throw error;
          quarantined.push({
            sourceId: id,
            file: at.file.name,
            pages: record.pages,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        handled++;
        if (handled % 10 === 0 || handled === total)
          progress?.({
            phase: "convert",
            done: handled,
            total,
            message: profile.say.converting(handled, total),
          });
      }
    } finally {
      await reader.close();
    }
  }
  if (!questions.length)
    throw new Error(profile.say.nothingPrepared(quarantined[0]?.reason));
  // Page order, whichever file a question was converted from, so questions that
  // share a reading stay next to each other.
  const position = new Map(
    ordered.map((record, i) => [`${profile.idPrefix}${record.id}`, i]),
  );
  questions.sort(
    (a, b) => position.get(String(a.id))! - position.get(String(b.id))!,
  );

  progress?.({
    phase: "finish",
    done: 1,
    total: 1,
    message: profile.say.checking,
  });
  const questionsJson = JSON.stringify({ schemaVersion: 1, questions });
  const counts = {
    section: tally(questions.map((q) => String(q.section))),
    testStatus: tally(questions.map((q) => String(q.testStatus))),
    difficulty: tally(questions.map((q) => String(q.difficulty))),
  };
  const report: PrepareReport = {
    parser: profile.parser,
    createdAt: new Date().toISOString(),
    activeMode: "unknown",
    interpretation: {},
    files: indexed.map((at) => ({
      filename: at.file.name,
      sha256: at.sha256,
      pages: at.pages,
      questions: at.records.length,
    })),
    comparison: {},
    conflicts: [],
    ...(ignored.length ? { ignored } : {}),
    ...(warnings.length ? { warnings } : {}),
    quarantined,
    uniqueSourceIds: collected.size,
    importedQuestions: questions.length,
    counts: {
      ...counts,
      ...(profile.idPrefix === "tsi-"
        ? {
            origin: tally(questions.map((q) => String(q.origin))),
            calculator: tally(questions.map((q) => String(q.calculator))),
          }
        : {}),
    },
  };
  return {
    manifest: {
      format: PREPARE_FORMAT,
      revision: await sha256Hex(new TextEncoder().encode(questionsJson)),
      label: profile.label,
      questionCount: questions.length,
      assets: [...usedAssets].sort(),
      summary: counts,
    },
    questionsJson,
    report,
  };
}
