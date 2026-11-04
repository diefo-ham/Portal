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
  type PaaRecord,
} from "./paa.ts";
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

const PARSER = "paa-pdf-browser-v1";

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

export async function preparePaaLibrary(
  chosen: readonly ReadableFile[],
  options: PrepareOptions,
  deps: PrepareDeps,
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
      )
        looksRight = isPaaQuestionPage(await reader.layout(page));
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
            message: `Leyendo ${file.name}: página ${page} de ${reader.pageCount}`,
          });
      }
      const records = indexPaaExport(file.name, layouts);
      if (!records.some(isPaaRecord)) {
        ignored.push(file.name);
        continue;
      }
      indexed.push({ file, sha256, pages: reader.pageCount, records });
    } finally {
      await reader.close();
    }
  }
  if (!indexed.length)
    throw new Error(
      `Ninguno de los PDF es una exportación de preguntas de la PAA, así que no se agregó nada. Se ignoraron: ${ignored.join(", ")}.`,
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
  const groups = groupPassages(ordered);

  const quarantined: QuarantinedQuestion[] = [];
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
          if (new Set(list.map((o) => paaSignature(o.record))).size > 1)
            throw new Error(
              "Same source ID has conflicting metadata or answer keys",
            );
          const text = convertPaaRecord(record, groups.get(id), overrides[id]);
          const layouts: PageLayout[] = [];
          for (const page of record.pages)
            layouts.push(await reader.layout(page));
          const plans = planCrops(record, layouts, "es");
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
            message: `Preparando preguntas: ${handled} de ${total}`,
          });
      }
    } finally {
      await reader.close();
    }
  }
  if (!questions.length)
    throw new Error(
      "No se pudo preparar ninguna pregunta. Comprueba que sean exportaciones de preguntas de la PAA." +
        (quarantined.length
          ? ` Primer problema: ${quarantined[0].reason}`
          : ""),
    );
  // Page order, whichever file a question was converted from, so questions that
  // share a reading stay next to each other.
  const position = new Map(ordered.map((record, i) => [`paa-${record.id}`, i]));
  questions.sort(
    (a, b) => position.get(String(a.id))! - position.get(String(b.id))!,
  );

  progress?.({
    phase: "finish",
    done: 1,
    total: 1,
    message: "Comprobando la biblioteca preparada…",
  });
  const questionsJson = JSON.stringify({ schemaVersion: 1, questions });
  const counts = {
    section: tally(questions.map((q) => String(q.section))),
    testStatus: tally(questions.map((q) => String(q.testStatus))),
    difficulty: tally(questions.map((q) => String(q.difficulty))),
  };
  const report: PrepareReport = {
    parser: PARSER,
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
    quarantined,
    uniqueSourceIds: collected.size,
    importedQuestions: questions.length,
    counts,
  };
  return {
    manifest: {
      format: PREPARE_FORMAT,
      revision: await sha256Hex(new TextEncoder().encode(questionsJson)),
      label: "PAA: preguntas preparadas desde PDF",
      questionCount: questions.length,
      assets: [...usedAssets].sort(),
      summary: counts,
    },
    questionsJson,
    report,
  };
}
