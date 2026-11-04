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
    ?.setAttribute("content", dark ? "#241e19" : "#f3f0e6");
}
export function saveAppearance(theme: Theme, originalPdf: boolean) {
  // If storage is unavailable, appearance still works for this tab.
  writeStorage(themeKey, theme);
  writeStorage(pdfKey, String(originalPdf));
  applyAppearance(theme, originalPdf);
}
