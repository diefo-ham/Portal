import { useT } from "../i18n";

export type BannersProps = {
  error: string;
  onDismissError: () => void;
  message: string;
  onDismissMessage: () => void;
};

/** The notices above the page: an error and a status message. */
export const Banners = ({
  error,
  onDismissError,
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
