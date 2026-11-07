import { useT } from "./i18n";

export type TestsLockedProps = {
  onAddQuestions: () => void;
};

/**
 * What the Tests screens show until the person has added question PDFs of their
 * own. The example questions that ship with the portal are for studying; a test
 * is built only from the questions the person brought.
 */
export const TestsLocked = ({ onAddQuestions }: TestsLockedProps) => {
  const t = useT();
  return (
    <main className="page narrow test-mode-page tests-locked-page">
      <p className="eyebrow">{t("TESTS")}</p>
      <h1>{t("Tests open when you add your own questions.")}</h1>
      <p className="muted">
        {t(
          "The example questions that come with this portal are for studying in Browse, Practice and Review. A test is built only from question PDFs you add yourself.",
        )}
      </p>
      <section className="empty-state" aria-label={t("Tests")}>
        <h2>{t("Add your question PDFs")}</h2>
        <p>
          {t(
            "They are prepared on this device and nothing is uploaded. Once you have added some, this page becomes the test setup.",
          )}
        </p>
        <button className="primary" onClick={onAddQuestions}>
          {t("Add your question PDFs")}
        </button>
      </section>
    </main>
  );
};
