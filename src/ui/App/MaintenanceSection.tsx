import { useState } from "react";
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
  /** TSI: the College Board sample items stored on this device, and how to remove them. */
  official?: { count: number; onRemove: () => Promise<void> };
};

/** Takes the Official (College Board sample) items off the device, after one confirmation. */
const RemoveOfficial = ({
  count,
  busy,
  onRemove,
}: {
  count: number;
  busy: boolean;
  onRemove: () => Promise<void>;
}) => {
  const t = useT();
  const [asking, setAsking] = useState(false);
  return (
    <section className="utility remove-official">
      <h3>{t("College Board sample items")}</h3>
      <p className="small muted">
        {t(
          "{n} items labelled Official are stored here. Removing them keeps your original items, your answers and your bookmarks. Add the PDFs again to bring them back.",
          { n: count },
        )}
      </p>
      {asking ? (
        <div className="confirm-row">
          <button
            className="danger"
            disabled={busy}
            onClick={() => void onRemove().finally(() => setAsking(false))}
          >
            {t("Yes, remove {n} official items", { n: count })}
          </button>
          <button disabled={busy} onClick={() => setAsking(false)}>
            {t("Cancel")}
          </button>
        </div>
      ) : (
        <button disabled={busy || !count} onClick={() => setAsking(true)}>
          {t("Remove official items")}
        </button>
      )}
    </section>
  );
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
  official,
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
      {official && official.count > 0 && (
        <RemoveOfficial
          count={official.count}
          busy={busy}
          onRemove={official.onRemove}
        />
      )}
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
