import { useEffect, useState } from "react";
import {
  applyAppearance,
  readOriginalPdf,
  readTheme,
  saveAppearance,
  type Theme,
} from "./appearance";

export function useAppearance() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [originalPdf, setOriginalPdf] = useState(readOriginalPdf);
  useEffect(() => {
    saveAppearance(theme, originalPdf);
    const system = matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance(theme, originalPdf);
    system.addEventListener("change", update);
    return () => system.removeEventListener("change", update);
  }, [theme, originalPdf]);
  return { theme, setTheme, originalPdf, setOriginalPdf };
}

export function AppearanceSettings({
  appearance,
}: {
  appearance: ReturnType<typeof useAppearance>;
}) {
  return (
    <section
      className="appearance-settings"
      aria-labelledby="appearance-heading"
    >
      <h2 id="appearance-heading">Appearance</h2>
      <label className="theme-control">
        Theme
        <select
          aria-label="Theme"
          value={appearance.theme}
          onChange={(event) => appearance.setTheme(event.target.value as Theme)}
        >
          <option value="auto">Auto · follow system</option>
          <option value="light">Light · paper & matcha</option>
          <option value="dark">Dark · earth & parchment</option>
        </select>
      </label>
      <label className="pdf-preference">
        <input
          type="checkbox"
          checked={appearance.originalPdf}
          onChange={(event) => appearance.setOriginalPdf(event.target.checked)}
        />{" "}
        Keep original PDF colors
      </label>
      <p className="small muted">
        PDF text and diagrams normally adapt to the reading theme. Use original
        colors when a figure’s colors matter; source files are unchanged.
      </p>
    </section>
  );
}
