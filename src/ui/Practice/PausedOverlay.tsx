import { useId } from "react";

export type PausedOverlayProps = {
  pending: boolean;
  onResume: () => void;
  onExit: () => void;
};

/** Covers a paused Practice Test until it is resumed or left. */
export const PausedOverlay = ({
  pending,
  onResume,
  onExit,
}: PausedOverlayProps) => {
  const headingId = useId();
  return (
    <div
      className="test-paused-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <section className="test-paused-card">
        <p className="eyebrow">PRACTICE TEST PAUSED</p>
        <h1 id={headingId}>Your time is frozen.</h1>
        <p className="muted">
          Answers, navigation, and the Calculator stay unavailable until you
          resume.
        </p>
        <button className="primary" disabled={pending} onClick={onResume}>
          Resume test
        </button>
        <button className="text-button" disabled={pending} onClick={onExit}>
          Exit test
        </button>
      </section>
    </div>
  );
};
