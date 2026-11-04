import { useT } from "../i18n";

/** The line under the Settings page. */
export const AppFooter = () => {
  const t = useT();
  return (
    <footer className="app-footer">
      <span>{t("Made for focused, independent study.")}</span>
      <span>{t("Personal practice · Not affiliated with College Board")}</span>
    </footer>
  );
};
