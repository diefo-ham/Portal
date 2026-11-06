import { clamp } from "@/src/utils/calculator";
import { readJson } from "@/src/utils/storage";
import type { Size, WindowGeometry } from "@/src/types/calculator";

export const geometryKey = "sat-calculator-window-v1";
/** The small keypad calculators (TSI Basic and Square root) remember their own window. */
export const compactGeometryKey = "sat-calculator-window-compact-v1";
export function clampGeometry(
  g: WindowGeometry,
  viewport: Size,
): WindowGeometry {
  const margin = 8;
  const maxWidth = Math.max(1, viewport.width - margin * 2);
  const maxHeight = Math.max(1, viewport.height - margin * 2);
  const width = Math.max(Math.min(440, maxWidth), Math.min(g.width, maxWidth));
  const height = Math.max(
    Math.min(360, maxHeight),
    Math.min(g.height, maxHeight),
  );
  return {
    width,
    height,
    x: clamp(g.x, margin, viewport.width - width - margin),
    y: clamp(g.y, margin, viewport.height - height - margin),
  };
}
export function defaultGeometry(
  viewport: Size,
  compact = false,
): WindowGeometry {
  if (compact)
    return clampGeometry(
      {
        x: viewport.width - 520 - 24,
        y: 92,
        width: 520,
        height: Math.min(520, viewport.height - 120),
      },
      viewport,
    );
  const width = Math.min(760, viewport.width * 0.58);
  return clampGeometry(
    {
      x: viewport.width - width - 24,
      y: 92,
      width,
      height: Math.min(590, viewport.height - 120),
    },
    viewport,
  );
}
export function readGeometry(viewport: Size, compact = false): WindowGeometry {
  // The saved value is untrusted: only use it if every field is a number.
  const value = readJson(
    compact ? compactGeometryKey : geometryKey,
  ) as Partial<WindowGeometry> | null;
  if (
    value &&
    [value.x, value.y, value.width, value.height].every(Number.isFinite)
  )
    return clampGeometry(value as WindowGeometry, viewport);
  return defaultGeometry(viewport, compact);
}
