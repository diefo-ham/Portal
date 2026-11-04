import { useEffect, useState } from "react";
import type { DocumentPanel, Question } from "../core/model";
import { readAsset } from "../storage/database";
import { useT } from "./i18n";
function Panel({ panel }: { panel: DocumentPanel }) {
  const t = useT();
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let url = "";
    if (panel.src.startsWith("data:")) {
      setSrc(panel.src);
      return;
    }
    setSrc("");
    setError("");
    readAsset(panel.src.slice(6))
      .then((blob) => {
        if (!blob)
          throw new Error(
            t(
              "Original PDF image is unavailable. Reload to retry importing the local library.",
            ),
          );
        if (alive) {
          url = URL.createObjectURL(blob);
          setSrc(url);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [panel.src, t]);
  return (
    <div className="pdf-panel">
      {error ? (
        <p role="alert">{error}</p>
      ) : src ? (
        <img
          src={src}
          alt={panel.alt}
          width={panel.width}
          height={panel.height}
        />
      ) : (
        <p className="muted small">{t("Loading original PDF content…")}</p>
      )}
    </div>
  );
}
export type DocumentPanelsProps = {
  question: Question;
  kind: "question" | "rationale";
};

export const DocumentPanels = ({ question, kind }: DocumentPanelsProps) => {
  const t = useT();
  return (
    <div
      className="pdf-document"
      aria-label={
        kind === "question"
          ? t("Original PDF question")
          : t("Original PDF explanation")
      }
    >
      {question.document?.[kind].map((panel, i) => (
        <Panel panel={panel} key={panel.src + i} />
      ))}
    </div>
  );
};
