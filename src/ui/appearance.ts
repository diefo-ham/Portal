import { readStorage, writeStorage } from "@/src/utils/storage";

export type Theme = "auto" | "light" | "dark";
const themeKey = "sat-theme";
const pdfKey = "sat-pdf-original";
export function readTheme(): Theme {
  const value = readStorage(themeKey);
  return value === "light" || value === "dark" ? value : "auto";
}
export function readOriginalPdf() {
  return readStorage(pdfKey) === "true";
}
export function applyAppearance(
  theme = readTheme(),
  originalPdf = readOriginalPdf(),
) {
  const dark =
    theme === "dark" ||
    (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.pdfAppearance = originalPdf
    ? "original"
    : "adapted";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0e1510" : "#e5eee8");
}
export function saveAppearance(theme: Theme, originalPdf: boolean) {
  // If storage is unavailable, appearance still works for this tab.
  writeStorage(themeKey, theme);
  writeStorage(pdfKey, String(originalPdf));
  const apply = () => applyAppearance(theme, originalPdf);
  // Where the browser can, the old look cross-fades into the new one.
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => unknown;
  };
  if (
    typeof doc.startViewTransition === "function" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    doc.startViewTransition(apply);
  else apply();
}
