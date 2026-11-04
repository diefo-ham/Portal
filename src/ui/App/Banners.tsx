import { useT } from "../i18n";

export type BannersProps = {
  error: string;
  onDismissError: () => void;
  /** A newer version of the portal has been downloaded. */
  updateReady: boolean;
  onUpdate: () => void;
  message: string;
  onDismissMessage: () => void;
};

/** The notices above the page: an error, a pending update, a status message. */
export const Banners = ({
  error,
  onDismissError,
  updateReady,
  onUpdate,
  message,
  onDismissMessage,
}: BannersProps) => {
  const t = useT();
  return (
    <>
      {error && (
        <div role="alert" className="banner error">
          {error}
          <button onClick={onDismissError} aria-label={t("Dismiss error")}>
            ×
          </button>
        </div>
      )}
      {updateReady && (
        <div role="status" className="banner">
          {t("A new version of the portal is ready.")}
          <button onClick={onUpdate}>{t("Reload to update")}</button>
        </div>
      )}
      {message && (
        <div role="status" className="banner">
          {message}
          <button onClick={onDismissMessage} aria-label={t("Dismiss message")}>
            ×
          </button>
        </div>
      )}
    </>
  );
};
