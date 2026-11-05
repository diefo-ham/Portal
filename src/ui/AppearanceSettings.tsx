import { useEffect, useState } from "react";
import {
  applyAppearance,
  readOriginalPdf,
  readTheme,
  saveAppearance,
  type Theme,
} from "./appearance";
import { useT } from "./i18n";
import { Select, type SelectOption } from "./Select";

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

export type AppearanceSettingsProps = {
  appearance: ReturnType<typeof useAppearance>;
};

export const AppearanceSettings = ({ appearance }: AppearanceSettingsProps) => {
  const t = useT();
  const themes: SelectOption<Theme>[] = [
    { value: "auto", label: t("Auto · follow system") },
    { value: "light", label: t("Light · paper & matcha") },
    { value: "dark", label: t("Dark · earth & parchment") },
  ];
  return (
    <section
      className="appearance-settings"
      aria-labelledby="appearance-heading"
    >
      <h2 id="appearance-heading">{t("Appearance")}</h2>
      <label className="theme-control">
        {t("Theme")}
        <Select
          aria-label={t("Theme")}
          value={appearance.theme}
          options={themes}
          onChange={appearance.setTheme}
        />
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
};
