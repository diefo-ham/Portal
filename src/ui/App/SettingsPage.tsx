import {
  AppearanceSettings,
  type AppearanceSettingsProps,
} from "../AppearanceSettings";
import { useT } from "../i18n";
import {
  MaintenanceSection,
  type MaintenanceSectionProps,
} from "./MaintenanceSection";
import {
  StudyPreferences,
  type StudyPreferencesProps,
} from "./StudyPreferences";

export type SettingsPageProps = {
  appearance: AppearanceSettingsProps["appearance"];
  preferences: StudyPreferencesProps;
  maintenance: MaintenanceSectionProps;
};

/** Appearance, study preferences, and the data maintenance tools. */
export const SettingsPage = ({
  appearance,
  preferences,
  maintenance,
}: SettingsPageProps) => {
  const t = useT();
  return (
    <main className="page narrow settings-page">
      <h1>{t("Settings")}</h1>
      <AppearanceSettings appearance={appearance} />
      <StudyPreferences {...preferences} />
      <MaintenanceSection {...maintenance} />
    </main>
  );
};
