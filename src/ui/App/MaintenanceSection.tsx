import type { StudyData } from "../../core/model";
import { ClearData } from "../ClearData";
import { PdfManager } from "../PdfManager";
import { ResetProgress } from "../ResetProgress";
import { useT } from "../i18n";

export type MaintenanceSectionProps = {
  /** This test's data: its questions, attempts and bookmarks are counted. */
  data: StudyData;
  busy: boolean;
  /** When the previous study state was archived by a reset, if it was. */
  archiveDate?: string;
  onAddPdfs: () => void;
  onRemovePdf: (key: string) => Promise<void>;
  onRestore: () => Promise<void>;
  onReset: (clearBookmarks: boolean) => Promise<void>;
  onRemoveQuestions: () => Promise<void>;
  onEraseEverything: () => Promise<void>;
};

/** Your questions: the PDFs, resetting progress, removing data, and what is stored. */
export const MaintenanceSection = ({
  data,
  busy,
  archiveDate,
  onAddPdfs,
  onRemovePdf,
  onRestore,
  onReset,
  onRemoveQuestions,
  onEraseEverything,
}: MaintenanceSectionProps) => {
  const t = useT();
  return (
    <section className="maintenance" aria-labelledby="maintenance-heading">
      <h2 id="maintenance-heading">{t("Your questions")}</h2>
      <p className="muted">
        {data.questions.length
          ? t("{n} questions are stored in this browser, with your answers.", {
              n: data.questions.length.toLocaleString(),
            })
          : t("No questions yet. Add your PDFs below.")}{" "}
        {t("Nothing is uploaded, and no account is needed.")}
      </p>
      <div className="data-grid">
        <PdfManager
          data={data}
          busy={busy}
          onAdd={onAddPdfs}
          onRemove={onRemovePdf}
        />
      </div>
      <ResetProgress
        busy={busy}
        archiveDate={archiveDate}
        onRestore={onRestore}
        onConfirm={onReset}
      />
      <ClearData
        busy={busy}
        hasQuestions={data.questions.length > 0}
        onRemoveQuestions={onRemoveQuestions}
        onEraseEverything={onEraseEverything}
      />
      <section className="local-storage-note">
        <h3>{t("Stored on this device")}</h3>
        <p>
          {t(
            "{questions} questions · {attempts} attempts · {bookmarks} bookmarks",
            {
              questions: data.questions.length,
              attempts: data.attempts.length,
              bookmarks: Object.values(data.annotations).filter(
                (a) => a.bookmarked,
              ).length,
            },
          )}
        </p>
        <p className="small muted">
          {t(
            "Everything lives in this browser, so clearing its site data for {origin} also removes it. Safari can also clear a site's data after about a week without a visit.",
            { origin: location.origin },
          )}
        </p>
      </section>
    </section>
  );
};
