import { useEffect, useState } from "react";
import {
  applyAppearance,
  readOriginalPdf,
  readTheme,
  saveAppearance,
  type Theme,
} from "./appearance";
import { useT } from "./i18n";

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
  const t = useT();
  return (
    <section
      className="appearance-settings"
      aria-labelledby="appearance-heading"
    >
      <h2 id="appearance-heading">{t("Appearance")}</h2>
      <label className="theme-control">
        {t("Theme")}
        <select
          aria-label={t("Theme")}
          value={appearance.theme}
          onChange={(event) => appearance.setTheme(event.target.value as Theme)}
        >
          <option value="auto">{t("Auto · follow system")}</option>
          <option value="light">{t("Light · paper & matcha")}</option>
          <option value="dark">{t("Dark · earth & parchment")}</option>
        </select>
      </label>
      <label className="pdf-preference">
        <input
          type="checkbox"
          checked={appearance.originalPdf}
          onChange={(event) => appearance.setOriginalPdf(event.target.checked)}
        />{" "}
        {t("Keep original PDF colors")}
      </label>
      <p className="small muted">
        {t(
          "PDF text and diagrams normally adapt to the reading theme. Use original colors when a figure’s colors matter; source files are unchanged.",
        )}
      </p>
    </section>
  );
}
