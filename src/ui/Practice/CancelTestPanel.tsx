export type CancelTestPanelProps = {
  pending: boolean;
  onKeep: () => void;
  onConfirm: () => void;
};

/** Confirms abandoning a Practice Test in progress. */
export const CancelTestPanel = ({
  pending,
  onKeep,
  onConfirm,
}: CancelTestPanelProps) => (
  <div className="tool-menu">
    <p>
      The resumable attempt will be removed without results or an SAT estimate.
      Questions already shown will remain used for Practice Tests.
    </p>
    <button onClick={onKeep}>Keep test</button>
    <button className="danger" disabled={pending} onClick={onConfirm}>
      Cancel Practice Test
    </button>
  </div>
);
