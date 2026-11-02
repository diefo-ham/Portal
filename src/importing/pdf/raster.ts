/**
 * Pixel helpers for question images. Operates on plain RGBA data, so it is
 * testable without a canvas or a PDF reader.
 */

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA, row-major, as `ImageData.data`. */
  data: Uint8ClampedArray;
}

/** Blank space kept above and below the content, in pixels. */
export const TRIM_MARGIN = 8;

/**
 * First and last (exclusive) rows holding any pixel that is not pure white,
 * or undefined for a blank image. Rendering with annotations hidden and a white
 * background makes untouched paper exactly white.
 */
export function contentRows(
  image: RasterImage,
): { top: number; bottom: number } | undefined {
  const { width, height, data } = image;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    let content = false;
    for (let x = 0; x < width * 4; x += 4)
      if (
        data[row + x] !== 255 ||
        data[row + x + 1] !== 255 ||
        data[row + x + 2] !== 255
      ) {
        content = true;
        break;
      }
    if (content) {
      if (top < 0) top = y;
      bottom = y + 1;
    }
  }
  return top < 0 ? undefined : { top, bottom };
}

/** Rows to keep: the content plus a margin, or everything for a blank image. */
export function trimmedRows(
  image: RasterImage,
  margin = TRIM_MARGIN,
): { top: number; bottom: number } {
  const rows = contentRows(image);
  if (!rows) return { top: 0, bottom: image.height };
  return {
    top: Math.max(0, rows.top - margin),
    bottom: Math.min(image.height, rows.bottom + margin),
  };
}

export function cropRows(
  image: RasterImage,
  top: number,
  bottom: number,
): RasterImage {
  const stride = image.width * 4;
  return {
    width: image.width,
    height: bottom - top,
    data: image.data.slice(top * stride, bottom * stride),
  };
}

export const trimWhite = (image: RasterImage, margin = TRIM_MARGIN) => {
  const { top, bottom } = trimmedRows(image, margin);
  return top === 0 && bottom === image.height
    ? image
    : cropRows(image, top, bottom);
};

/** Pixel bounds of a crop rectangle given in points, rounded outward. */
export function pixelBounds(
  rect: { x0: number; y0: number; x1: number; y1: number },
  scale: number,
  limit: { width: number; height: number },
) {
  const x0 = Math.max(0, Math.floor(rect.x0 * scale));
  const y0 = Math.max(0, Math.floor(rect.y0 * scale));
  const x1 = Math.min(limit.width, Math.ceil(rect.x1 * scale));
  const y1 = Math.min(limit.height, Math.ceil(rect.y1 * scale));
  return { x0, y0, x1, y1 };
}
