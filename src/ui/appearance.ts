export type Theme = "auto" | "light" | "dark";
const themeKey = "sat-theme";
const pdfKey = "sat-pdf-original";
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(themeKey);
    return value === "light" || value === "dark" ? value : "auto";
  } catch {
    return "auto";
  }
}
export function readOriginalPdf() {
  try {
    return localStorage.getItem(pdfKey) === "true";
  } catch {
    return false;
  }
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
  try {
    localStorage.setItem(themeKey, theme);
    localStorage.setItem(pdfKey, String(originalPdf));
  } catch {
    /* Appearance still works for this tab. */
  }
  applyAppearance(theme, originalPdf);
}
