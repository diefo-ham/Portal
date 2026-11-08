/**
 * Prepares a PAA question library from the person's own PDF export(s). The
 * result has the same shape as the SAT library (manifest, questions document,
 * images), so it goes through the same validation and storage. Unlike the SAT
 * export there is no active/inactive pairing and no required file names: any
 * number of PDFs is accepted, and a question ID seen twice must agree with
 * itself or the question is left out.
 */
import type { Assessment } from "../../core/model.ts";
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
import { accessChecker, accessDigest } from "./access.ts";
import { KNOWN_EXCEPTIONS } from "./exceptions.ts";
import {
  convertSatRecord,
  isSatBankRecord,
  satSignature,
  satStatus,
} from "./sat.ts";
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
  /**
   * The test whose access code every page must carry (see `access.ts`). Only
   * the bundled-examples generator leaves it out, through `forExamples`.
   */
  accessCode?: Assessment;
  /** Reviewed exceptions known for this test's source IDs (a file can add more). */
  knownExceptions?: Record<string, ReviewedOverride>;
  /** The question's status when the page says so (the SAT badge); else unknown. */
  status?(record: PaaRecord): "active" | "inactive" | "unknown";
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
    /** No page of the chosen PDF(s) carried the access code. */
    noAccess(refused: string[]): string;
    nothingPrepared(firstProblem: string | undefined): string;
  };
}

export const PAA_PROFILE: BankProfile = {
  parser: "paa-pdf-browser-v1",
  label: "PAA: preguntas preparadas desde PDF",
  idPrefix: "paa-",
  language: "es",
  accepts: isPaaRecord,
  accessCode: "PAA",
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
      `Ninguno de los PDF es un PDF de preguntas, así que no se agregó nada. Se ignoraron: ${ignored.join(", ")}.`,
    noAccess: (refused) =>
      `No se agregó nada: ninguna página lleva el código de acceso. Archivos: ${refused.join(", ")}.`,
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
  accessCode: "TSI",
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
      `None of the PDFs is a question PDF, so nothing was added. Set aside: ${ignored.join(", ")}.`,
    noAccess: (refused) =>
      `Nothing was added: no page carries the access code. Files: ${refused.join(", ")}.`,
    nothingPrepared: (first) =>
      "No question could be prepared. Check that these are TSIA2 question exports." +
      (first ? ` First problem: ${first}` : ""),
  },
};

/**
 * SAT questions: one PDF with every SAT question, both tests, and the ACTIVE /
 * INACTIVE badge on each page. IDs and source match what the earlier four-file
 * reader produced, so questions imported that way are recognised and keep their
 * answers and bookmarks.
 */
export const SAT_PROFILE: BankProfile = {
  parser: "sat-pdf-browser-v1",
  label: "SAT: questions prepared from PDF",
  idPrefix: "cb-",
  language: "en",
  accepts: isSatBankRecord,
  accessCode: "SAT",
  knownExceptions: KNOWN_EXCEPTIONS,
  status: satStatus,
  group: () => new Map(),
  signature: satSignature,
  convert: (record, _group, override) => {
    const { text, notes } = convertSatRecord(record, override);
    return { text: text as unknown as Record<string, unknown>, notes };
  },
  say: {
    reading: (file, page, pages) => `Reading ${file}: page ${page} of ${pages}`,
    converting: (done, total) => `Preparing questions: ${done} of ${total}`,
    checking: "Checking the prepared library…",
    noneQualified: (ignored) =>
      `None of the PDFs is a question PDF, so nothing was added. Set aside: ${ignored.join(", ")}.`,
    noAccess: (refused) =>
      `Nothing was added: no page carries the access code. Files: ${refused.join(", ")}.`,
    nothingPrepared: (first) =>
      "No question could be prepared. Check that this is the SAT question PDF." +
      (first ? ` First problem: ${first}` : ""),
  },
};

/**
 * The same reading without the access check, for the bundled examples: the
 * example PDFs are the portal's own and carry no code. Only
 * `scripts/build-examples.mjs` uses this; every import path uses the profiles
 * above as they are.
 */
export const forExamples = (profile: BankProfile): BankProfile => ({
  ...profile,
  accessCode: undefined,
});

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
  /** SHA-256 of the access code this PDF carried; absent for the examples. */
  access?: string;
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

export const prepareSatLibrary = (
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
) => prepareBankLibrary(chosen, options, deps, SAT_PROFILE);

export async function prepareBankLibrary(
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
  profile: BankProfile,
): Promise<PreparedLibrary> {
  const { signal, progress } = options;
  const overrides = { ...profile.knownExceptions, ...options.overrides };
  // A fixed order keeps the library revision the same for the same PDFs.
  const files = [...chosen].sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) throw new Error("Choose at least one PDF.");

  const indexed: Indexed[] = [];
  // A chosen PDF that is not an export of this test's questions (a letter, a
  // study guide, another test's export) is set aside instead of stopping the others.
  const ignored: string[] = [];
  // PDFs where no page carried the access code.
  const refused: string[] = [];
  const quarantined: QuarantinedQuestion[] = [];
  const hasAccess = deps.access ?? accessChecker();
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
      const found = indexPaaExport(file.name, layouts);
      if (!found.some(profile.accepts)) {
        ignored.push(file.name);
        continue;
      }
      // The access code, found on any one page, accepts the whole PDF; none
      // found refuses it. What the app keeps is the code's hash, so a later
      // version can revoke the PDF if that code is replaced.
      let access: string | undefined;
      if (profile.accessCode) {
        for (const record of found) {
          if (
            profile.accepts(record) &&
            (await hasAccess(profile.accessCode, record.ref))
          ) {
            access = await accessDigest(record.ref!);
            break;
          }
        }
        if (!access) {
          refused.push(file.name);
          continue;
        }
      }
      indexed.push({
        file,
        sha256,
        pages: reader.pageCount,
        records: found,
        access,
      });
    } finally {
      await reader.close();
    }
  }
  if (!indexed.length)
    throw new Error(
      refused.length
        ? profile.say.noAccess(refused)
        : profile.say.noneQualified(ignored),
    );

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
            // Only the SAT says whether a question is in a live practice test.
            testStatus: profile.status?.(record) ?? "unknown",
            document: {
              question: panels.question,
              rationale: panels.rationale,
              textIsApproximate: true,
              answerKeyOrigin,
              provenance: list.map((o) => ({
                filename: o.at.file.name,
                sha256: o.at.sha256,
                pages: o.record.pages,
                ...(o.at.access ? { access: o.at.access } : {}),
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
    files: indexed.map((at) => ({
      filename: at.file.name,
      sha256: at.sha256,
      pages: at.pages,
      questions: at.records.length,
    })),
    ...(ignored.length ? { ignored } : {}),
    ...(refused.length ? { refused } : {}),
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
