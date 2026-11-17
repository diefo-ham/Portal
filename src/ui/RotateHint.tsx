import { useState } from "react";
import { readStorage, writeStorage } from "@/src/utils/storage";
import { useT } from "./i18n";

const KEY = "sat-rotate-hint";

/**
 * A question read from a PDF is a picture of its page, so on a phone held
 * upright its text is very small. This tip suggests turning the phone; the
 * stylesheet shows it only on an upright phone, and hiding it is remembered.
 */
export const RotateHint = () => {
  const t = useT();
  const [hidden, setHidden] = useState(() => readStorage(KEY) === "off");
  if (hidden) return null;
  return (
    <p className="rotate-hint small">
      <span>{t("Turn your phone sideways for larger text.")}</span>
      <button
        className="text-button"
        onClick={() => {
          // If storage is unavailable the tip is still hidden for this visit.
          writeStorage(KEY, "off");
          setHidden(true);
        }}
      >
        {t("Hide this tip")}
      </button>
    </p>
  );
};
