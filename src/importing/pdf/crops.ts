/**
 * Where to cut each question's pages into a question image and an explanation
 * image. Ported from `convert` in scripts/import_question_bank.py: the question
 * ends just above the "Correct Answer:" label, and the explanation starts just
 * below it. Pages are never guessed at; unclear boundaries throw so the question
 * is quarantined instead of imported with answer text in its question image.
 */
import { findPhrase, type Box, type PageLayout } from "./layout.ts";
import { accessLine } from "./marks.ts";
import type { SourceRecord } from "./segment.ts";

export type PanelKind = "question" | "rationale";

export interface PanelPlan {
  kind: PanelKind;
  /** 1-based page number in the export. */
  page: number;
  /** In points, origin at the top-left of the page. */
  rect: Box;
  alt: string;
  /** Places on the page (points) to paint white, such as a printed calculator tag. */
  mask?: Box[];
}

export interface CropOptions {
  /** Phrases to paint over in the question image only (e.g. "[basic]"). */
  maskPhrases?: readonly string[];
}

/** Margin kept inside the page edges, in points. */
const SIDE_MARGIN = 16;
/** The explanation starts this far below the answer-key label. */
const BELOW_KEY = 6;
/** The question image starts this far below the heading. */
const BELOW_HEADING = 0.2;

const labelHits = (page: PageLayout, phrase: string) =>
  findPhrase(page, phrase).filter((box) => box.x0 < 25 && box.y0 > 70);

export function planCrops(
  record: SourceRecord,
  pages: readonly PageLayout[],
  language: "en" | "es" = "en",
  options: CropOptions = {},
): PanelPlan[] {
  if (pages.length !== record.pages.length)
    throw new Error("Page layouts do not match the question's pages");
  const plans: PanelPlan[] = [];
  let foundKey = false;
  record.pages.forEach((pageNumber, index) => {
    const page = pages[index];
    const key = findPhrase(page, "Correct Answer:")[0];
    const rationale = labelHits(page, "Rationale")[0];
    const boundary = key ?? rationale;
    let start = 0;
    if (index === 0) {
      const heading = labelHits(page, "Question")[0];
      if (!heading) throw new Error("Cannot locate question crop boundary");
      start = heading.y1 + BELOW_HEADING;
    }
    // The access line at the bottom left is not part of the explanation.
    const access = accessLine(page);
    const end = access ? access.y0 - 1 : page.height;
    const rect = (y0: number, y1: number): Box => ({
      x0: SIDE_MARGIN,
      y0,
      x1: page.width - SIDE_MARGIN,
      y1,
    });
    if (!foundKey) {
      const questionEnd = boundary ? boundary.y0 - 1 : end;
      if (questionEnd > start + 2) {
        const area = rect(start, questionEnd);
        const mask = (options.maskPhrases ?? [])
          .flatMap((phrase) => findPhrase(page, phrase))
          .filter(
            (box) =>
              box.y0 >= area.y0 - 1 &&
              box.y1 <= area.y1 + 1 &&
              box.x0 >= area.x0 &&
              box.x1 <= area.x1,
          );
        plans.push({
          kind: "question",
          page: pageNumber,
          rect: area,
          ...(mask.length ? { mask } : {}),
          alt:
            language === "es"
              ? `Pregunta ${record.id}, página ${pageNumber} del original. El diseño original incluye las opciones de respuesta.`
              : `Question ${record.id}, source page ${pageNumber}. Original layout includes any answer choices.`,
        });
      }
    }
    if (boundary) {
      if (foundKey) throw new Error("Multiple visual answer key boundaries");
      foundKey = true;
      start = key ? key.y1 + BELOW_KEY : rationale!.y0 - 2;
    }
    if (foundKey && end > start + 2)
      plans.push({
        kind: "rationale",
        page: pageNumber,
        rect: rect(start, end),
        alt:
          language === "es"
            ? `Explicación de ${record.id}, página ${pageNumber} del original.`
            : `Explanation for ${record.id}, source page ${pageNumber}.`,
      });
  });
  if (
    !foundKey ||
    !plans.some((plan) => plan.kind === "question") ||
    !plans.some((plan) => plan.kind === "rationale")
  )
    throw new Error("Incomplete question/explanation crop boundaries");
  return plans;
}
