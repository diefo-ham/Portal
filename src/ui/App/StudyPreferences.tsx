import { useT } from "../i18n";
import { PreferenceToggle } from "./PreferenceToggle";

export type StudyPreferencesProps = {
  timerDefault: boolean;
  onTimerDefault: (value: boolean) => void;
  showCorrectExplanations: boolean;
  onShowCorrectExplanations: (value: boolean) => void;
  deleteRemovesAnswers: boolean;
  onDeleteRemovesAnswers: (value: boolean) => void;
  /** Whether this test has practice-test questions worth protecting (the SAT). */
  offerProtection: boolean;
  protectedTests: boolean;
  onProtectedTests: (value: boolean) => void;
  /** TSI only, when the bank holds both Official and Original questions. */
  originalQuestions?: { checked: boolean; onChange: (value: boolean) => void };
};

/** The study checkboxes on the Settings page. */
export const StudyPreferences = ({
  timerDefault,
  onTimerDefault,
  showCorrectExplanations,
  onShowCorrectExplanations,
  deleteRemovesAnswers,
  onDeleteRemovesAnswers,
  offerProtection,
  protectedTests,
  onProtectedTests,
  originalQuestions,
}: StudyPreferencesProps) => {
  const t = useT();
  return (
    <section className="utility study-preferences">
      <h2>{t("Study preferences")}</h2>
      <PreferenceToggle
        checked={timerDefault}
        onChange={onTimerDefault}
        label={t("Timer on by default")}
        hint={t(
          "New sessions start with the timer visible. Each session remembers its own choice afterward.",
        )}
      />
      <PreferenceToggle
        checked={showCorrectExplanations}
        onChange={onShowCorrectExplanations}
        label={t("Show explanations after correct answers")}
        hint={t(
          "When off, correct answers stay concise and the explanation remains available on request. Incorrect answers always show it.",
        )}
      />
      <PreferenceToggle
        checked={deleteRemovesAnswers}
        onChange={onDeleteRemovesAnswers}
        label={t("Deleting a session also removes its answers")}
        hint={t(
          "Off by default: a deleted session leaves your answers, mistakes and accuracy as they are. On: its answers are removed from your progress, and those questions become unanswered again.",
        )}
      />
      {originalQuestions && (
        <PreferenceToggle
          checked={originalQuestions.checked}
          onChange={originalQuestions.onChange}
          label={t("Include original questions")}
          hint={t(
            "When off, the original questions are hidden everywhere (practice, Browse, Review and your progress) and nothing is deleted. Sessions that contain them stay, without those questions. Turn it on to bring them back.",
          )}
        />
      )}
      {offerProtection && (
        <PreferenceToggle
          checked={protectedTests}
          onChange={onProtectedTests}
          label="Protect unused practice-test questions"
          hint="Active questions are hidden by default. You can override this for a session in Refine selection. Unknown status is not a guarantee against future College Board test spoilers."
        />
      )}
    </section>
  );
};
