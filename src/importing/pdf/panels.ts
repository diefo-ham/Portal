/**
 * Turns a crop plan into stored images. The page renderer, the encoder, and the
 * asset store are injected, so this logic is tested without a browser and the
 * PDF reader stays confined to pdfjsAdapter.ts.
 */
import type { Box } from "./layout.ts";
import type { PanelPlan } from "./crops.ts";
import {
  contentRows,
  paintOver,
  trimWhite,
  type RasterImage,
} from "./raster.ts";

/** One image of a question, in the shape the study data already uses. */
export interface Panel {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface PanelRenderer {
  /** Pixels for a rectangle (in points) of a 1-based page, on white paper with annotations hidden. */
  render(page: number, rect: Box): Promise<RasterImage>;
}

export interface PanelStore {
  /** Lossless encoding of the pixels; the bytes are what gets hashed. */
  encode(image: RasterImage): Promise<Blob>;
  /** Stores an image under its content-hash key; storing the same key again is harmless. */
  put(key: string, blob: Blob): Promise<void>;
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function storePanel(
  plan: PanelPlan,
  image: RasterImage,
  store: PanelStore,
): Promise<Panel> {
  const blob = await store.encode(image);
  // Browsers that cannot encode WebP (Safari) give lossless PNG instead.
  const extension = blob.type === "image/png" ? ".png" : ".webp";
  const key = (await sha256Hex(await blob.arrayBuffer())) + extension;
  await store.put(key, blob);
  return {
    src: "asset:" + key,
    alt: plan.alt,
    width: image.width,
    height: image.height,
  };
}

export async function buildPanel(
  plan: PanelPlan,
  renderer: PanelRenderer,
  store: PanelStore,
): Promise<Panel> {
  const raw = paintOver(
    await renderer.render(plan.page, plan.rect),
    plan.rect,
    plan.mask ?? [],
  );
  return storePanel(plan, trimWhite(raw), store);
}

export async function buildPanels(
  plans: readonly PanelPlan[],
  renderer: PanelRenderer,
  store: PanelStore,
): Promise<{ question: Panel[]; rationale: Panel[] }> {
  // Sequential on purpose: panels share one rendered page at a time.
  const rendered: { plan: PanelPlan; image: RasterImage; blank: boolean }[] =
    [];
  for (const plan of plans) {
    const raw = paintOver(
      await renderer.render(plan.page, plan.rect),
      plan.rect,
      plan.mask ?? [],
    );
    rendered.push({
      plan,
      image: trimWhite(raw),
      blank: contentRows(raw) === undefined,
    });
  }
  // A panel with nothing on it (usually an empty last page) only adds white
  // space. Keep one per kind regardless, so a question is never left without.
  const panels = { question: [] as Panel[], rationale: [] as Panel[] };
  for (const [index, item] of rendered.entries()) {
    const sameKind = rendered.filter(
      (other) => other.plan.kind === item.plan.kind,
    );
    if (item.blank && sameKind.some((other) => !other.blank)) continue;
    if (item.blank && sameKind.indexOf(rendered[index]) > 0) continue;
    panels[item.plan.kind].push(await storePanel(item.plan, item.image, store));
  }
  return panels;
}
