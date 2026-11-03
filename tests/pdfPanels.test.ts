import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { layoutPage, type TextFragment } from "../src/importing/pdf/layout.ts";
import { planCrops } from "../src/importing/pdf/crops.ts";
import {
  contentRows,
  cropRows,
  pixelBounds,
  trimWhite,
  trimmedRows,
  type RasterImage,
} from "../src/importing/pdf/raster.ts";
import {
  buildPanel,
  buildPanels,
  type PanelRenderer,
  type PanelStore,
} from "../src/importing/pdf/panels.ts";
import type { SourceRecord } from "../src/importing/pdf/segment.ts";

const run = (
  text: string,
  x: number,
  baseline: number,
  size = 7.89,
  width = text.length * size * 0.5,
  endsLine = true,
): TextFragment => ({ text, x, baseline, width, size, endsLine });

/** Label baselines chosen so the boxes match PyMuPDF's (heading 129.0 to 136.89). */
const heading = (baseline = 135.75) => run("Question", 18, baseline, 7.89, 36);
const key = (baseline: number) => [
  run("Correct", 18, baseline, 7.89, 30, false),
  run("Answer:", 52, baseline, 7.89, 33),
];
const rationale = (baseline: number) =>
  run("Rationale", 18, baseline, 7.89, 38);
const body = (baseline: number) => run("Body text.", 18, baseline, 9.29, 40);

const record = (pages: number[]): SourceRecord => ({
  id: "abc12345",
  startPage: pages[0],
  pages,
  texts: [],
  section: "Math",
  domain: "Algebra",
  skill: "Linear functions",
  difficulty: "Easy",
});
const page = (fragments: TextFragment[]) => layoutPage(fragments, 792, 612);

describe("planCrops", () => {
  it("cuts a single page into a question image and an explanation image", () => {
    const plans = planCrops(record([1]), [
      page([heading(), body(200), ...key(354.75), rationale(384), body(420)]),
    ]);
    expect(plans).toHaveLength(2);
    const [question, explanation] = plans;
    expect(question).toMatchObject({
      kind: "question",
      page: 1,
      alt: "Question abc12345, source page 1. Original layout includes any answer choices.",
    });
    // Starts 0.2 pt below the heading and ends 1 pt above the answer-key label.
    expect(question.rect.x0).toBe(16);
    expect(question.rect.x1).toBe(596);
    expect(question.rect.y0).toBeCloseTo(136.89 + 0.2, 2);
    expect(question.rect.y1).toBeCloseTo(348.0 - 1, 2);
    expect(explanation).toMatchObject({
      kind: "rationale",
      page: 1,
      alt: "Explanation for abc12345, source page 1.",
    });
    // Starts 6 pt below the key label and runs to the page bottom.
    expect(explanation.rect.y0).toBeCloseTo(355.89 + 6, 2);
    expect(explanation.rect.y1).toBe(792);
  });

  it("keeps continuation pages with the part of the question they belong to", () => {
    const plans = planCrops(record([5, 6, 7]), [
      page([heading(), body(200)]),
      page([body(60), ...key(300), rationale(330)]),
      page([body(60)]),
    ]);
    expect(plans.map((plan) => [plan.kind, plan.page])).toEqual([
      ["question", 5],
      ["question", 6],
      ["rationale", 6],
      ["rationale", 7],
    ]);
    // A continuation page is cut from its top edge.
    expect(plans[1].rect.y0).toBe(0);
    expect(plans[3].rect).toMatchObject({ y0: 0, y1: 792 });
  });

  it("falls back to the Rationale label when no key label is printed", () => {
    const plans = planCrops(record([1]), [
      page([heading(), body(200), rationale(380)]),
    ]);
    // Rationale box top is 380 - 0.8555 * 7.89 = 373.25.
    expect(plans[0].rect.y1).toBeCloseTo(373.25 - 1, 1);
    expect(plans[1].rect.y0).toBeCloseTo(373.25 - 2, 1);
  });

  it("refuses unclear boundaries instead of guessing", () => {
    expect(() =>
      planCrops(record([1]), [page([body(200), ...key(300), rationale(330)])]),
    ).toThrow("Cannot locate question crop boundary");
    expect(() =>
      planCrops(record([1, 2]), [
        page([heading(), ...key(300), rationale(330)]),
        page([...key(300), rationale(330)]),
      ]),
    ).toThrow("Multiple visual answer key boundaries");
    expect(() =>
      planCrops(record([1]), [page([heading(), body(200)])]),
    ).toThrow("Incomplete question/explanation crop boundaries");
    expect(() => planCrops(record([1, 2]), [page([heading()])])).toThrow(
      "do not match",
    );
  });
});

/** An RGBA image filled with white, with rows of black pixels at the given y values. */
function image(width: number, height: number, blackRows: number[] = []) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const y of blackRows)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  return { width, height, data } satisfies RasterImage;
}

describe("raster", () => {
  it("finds content rows and ignores pure white paper", () => {
    expect(contentRows(image(4, 20))).toBeUndefined();
    expect(contentRows(image(4, 20, [5, 9]))).toEqual({ top: 5, bottom: 10 });
    // Even a nearly white pixel counts as content, as in the Python tool.
    const faint = image(4, 6);
    faint.data[(3 * 4 + 1) * 4] = 254;
    expect(contentRows(faint)).toEqual({ top: 3, bottom: 4 });
  });

  it("keeps an eight pixel margin around content and never exceeds the image", () => {
    expect(trimmedRows(image(4, 100, [30, 50]))).toEqual({
      top: 22,
      bottom: 59,
    });
    expect(trimmedRows(image(4, 40, [3, 38]))).toEqual({ top: 0, bottom: 40 });
    expect(trimmedRows(image(4, 40))).toEqual({ top: 0, bottom: 40 });
  });

  it("trims only vertically", () => {
    const source = image(6, 100, [40]);
    const trimmed = trimWhite(source);
    expect(trimmed.width).toBe(6);
    expect(trimmed.height).toBe(17);
    expect(trimWhite(image(6, 30))).toEqual(image(6, 30));
    expect(cropRows(source, 10, 12).data).toHaveLength(6 * 2 * 4);
  });

  it("rounds crop rectangles outward and clamps them to the page", () => {
    expect(
      pixelBounds({ x0: 16, y0: 136.99, x1: 596, y1: 347.01 }, 2, {
        width: 1224,
        height: 1584,
      }),
    ).toEqual({ x0: 32, y0: 273, x1: 1192, y1: 695 });
    expect(
      pixelBounds({ x0: -5, y0: 0, x1: 700, y1: 800 }, 2, {
        width: 1224,
        height: 1584,
      }),
    ).toEqual({ x0: 0, y0: 0, x1: 1224, y1: 1584 });
  });
});

/** A store that "encodes" pixels as raw bytes and remembers what it was given. */
function fixtures(pages: Record<number, RasterImage>) {
  const stored = new Map<string, Blob>();
  const requests: { page: number; y0: number }[] = [];
  const renderer: PanelRenderer = {
    async render(page, rect) {
      requests.push({ page, y0: rect.y0 });
      return pages[page];
    },
  };
  const store: PanelStore = {
    encode: async (img) =>
      new Blob([new Uint8Array(img.data.buffer, 0, img.data.length)], {
        type: "image/webp",
      }),
    put: async (key, blob) => void stored.set(key, blob),
  };
  return { stored, requests, renderer, store };
}

describe("panels", () => {
  const plan = {
    kind: "question" as const,
    page: 3,
    rect: { x0: 16, y0: 100, x1: 596, y1: 300 },
    alt: "Question x",
  };

  it("trims, hashes the stored bytes, and names the asset after the hash", async () => {
    const trimmedSource = image(6, 100, [40]);
    const { stored, renderer, store } = fixtures({ 3: trimmedSource });
    const panel = await buildPanel(plan, renderer, store);
    const expected = trimWhite(trimmedSource);
    const digest = createHash("sha256")
      .update(Buffer.from(expected.data.buffer, 0, expected.data.length))
      .digest("hex");
    expect(panel).toEqual({
      src: `asset:${digest}.webp`,
      alt: "Question x",
      width: 6,
      height: 17,
    });
    expect([...stored.keys()]).toEqual([`${digest}.webp`]);
  });

  it("stores identical pictures once and files panels by kind", async () => {
    const { stored, requests, renderer, store } = fixtures({
      3: image(6, 100, [40]),
      4: image(6, 100, [40]),
    });
    const panels = await buildPanels(
      [
        plan,
        { ...plan, page: 4 },
        { ...plan, kind: "rationale", page: 4, alt: "Explanation x" },
      ],
      renderer,
      store,
    );
    expect(panels.question).toHaveLength(2);
    expect(panels.rationale).toHaveLength(1);
    expect(stored.size).toBe(1);
    expect(requests.map((r) => r.page)).toEqual([3, 4, 4]);
  });

  it("drops blank panels but never leaves a kind empty", async () => {
    const { stored, renderer, store } = fixtures({
      3: image(6, 100, [40]),
      4: image(6, 100),
      5: image(6, 100),
    });
    const explanation = { ...plan, kind: "rationale" as const };
    const panels = await buildPanels(
      [plan, { ...explanation, page: 3 }, { ...explanation, page: 4 }],
      renderer,
      store,
    );
    expect(panels.question).toHaveLength(1);
    expect(panels.rationale).toHaveLength(1);
    expect(panels.rationale[0].height).toBe(17);
    const onlyBlank = await buildPanels(
      [
        { ...explanation, page: 4 },
        { ...explanation, page: 5 },
      ],
      renderer,
      store,
    );
    expect(onlyBlank.rationale).toHaveLength(1);
    expect(stored.size).toBe(2);
  });
});
