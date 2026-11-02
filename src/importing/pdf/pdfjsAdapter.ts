/**
 * The only module that talks to pdf.js. It turns a PDF into page layouts and
 * rendered pixels; everything else in src/importing/pdf is independent of the
 * reader. Load this file lazily (dynamic import) so studying never pays for it.
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  fragmentsFromItems,
  layoutPage,
  type Box,
  type PageLayout,
} from "./layout.ts";
import type { PanelRenderer, PanelStore } from "./panels.ts";
import { pixelBounds, type RasterImage } from "./raster.ts";

/** Rendering scale: 2 pixels per point, as in the Python tool. */
export const RENDER_SCALE = 2;

export interface ExportDocument {
  pageCount: number;
  layout(pageNumber: number): Promise<PageLayout>;
  renderer: PanelRenderer;
  close(): Promise<void>;
}

export async function openExport(data: Uint8Array): Promise<ExportDocument> {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data, useSystemFonts: false });
  const doc = await task.promise;
  let rendered:
    { page: number; context: OffscreenCanvasRenderingContext2D } | undefined;

  const renderPage = async (pageNumber: number) => {
    if (rendered?.page === pageNumber) return rendered.context;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = new OffscreenCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const context = canvas.getContext("2d", {
      // An opaque canvas turns on LCD text smoothing, which tints glyph edges with
      // colour. Keep alpha so edges stay grey; the page is painted white below.
      alpha: true,
      willReadFrequently: true,
    })!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Annotations are hidden: a reader's highlight must not reveal the answer.
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
      annotationMode: pdfjs.AnnotationMode.DISABLE,
    }).promise;
    page.cleanup();
    rendered = { page: pageNumber, context };
    return context;
  };

  return {
    pageCount: doc.numPages,
    async layout(pageNumber) {
      const page = await doc.getPage(pageNumber);
      const [left, bottom, right, top] = page.view;
      const { items } = await page.getTextContent();
      const layout = layoutPage(
        fragmentsFromItems(items, top),
        top - bottom,
        right - left,
      );
      page.cleanup();
      return layout;
    },
    renderer: {
      async render(pageNumber: number, rect: Box): Promise<RasterImage> {
        const context = await renderPage(pageNumber);
        const { x0, y0, x1, y1 } = pixelBounds(
          rect,
          RENDER_SCALE,
          context.canvas,
        );
        const { width, height, data } = context.getImageData(
          x0,
          y0,
          x1 - x0,
          y1 - y0,
        );
        return { width, height, data };
      },
    },
    close: async () => {
      rendered = undefined;
      await task.destroy();
    },
  };
}

/** Encodes pixels as lossless WebP. Callers must check `blob.type` for browser support. */
export async function encodeWebp(image: RasterImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d")!;
  context.putImageData(
    new ImageData(
      image.data as Uint8ClampedArray<ArrayBuffer>,
      image.width,
      image.height,
    ),
    0,
    0,
  );
  return canvas.convertToBlob({ type: "image/webp", quality: 1 });
}

export const webpStore = (put: PanelStore["put"]): PanelStore => ({
  encode: encodeWebp,
  put,
});
