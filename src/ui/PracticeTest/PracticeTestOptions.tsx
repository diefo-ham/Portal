import type { TestSelection } from "../../core/model";
import { selections } from "../../core/practiceTest";

export type Timing = "timed" | "untimed";

export type PracticeTestOptionsProps = {
  selection: TestSelection;
  timing: Timing;
  /** Why a test cannot start (for example, not enough unused questions). */
  error?: string;
  busy: boolean;
  onSelection: (selection: TestSelection) => void;
  onTiming: (timing: Timing) => void;
  onStart: () => void;
  onSettings: () => void;
};

/** What the chosen selection and timing mean, in one sentence for the form. */
export const describeTest = (selection: TestSelection, timing: Timing) =>
  `${
    selection === "full"
      ? "98 questions · four modules · optional 10-minute break."
      : `${selection.startsWith("math") ? 22 : 27} questions · one module.`
  } ${
    timing === "timed"
      ? "32 minutes per Reading and Writing module; 35 minutes per Math module."
      : "Elapsed time only. No deadline or automatic module end."
  } Leaving an active module pauses its clock until you explicitly resume.`;

/** The form that picks a test and its timing, and starts it. */
export const PracticeTestOptions = ({
  selection,
  timing,
  error,
  busy,
  onSelection,
  onTiming,
  onStart,
  onSettings,
}: PracticeTestOptionsProps) => (
  <section className="utility test-setup-fields">
    <label>
      Test selection
      <select
        value={selection}
        onChange={(e) => onSelection(e.target.value as TestSelection)}
      >
        {selections.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
    <label>
      Timing
      <select
        value={timing}
        onChange={(e) => onTiming(e.target.value as Timing)}
      >
        <option value="timed">Timed</option>
        <option value="untimed">Untimed</option>
      </select>
    </label>
    <p className="small muted">{describeTest(selection, timing)}</p>
    {error && (
      <p role="status">
        {error}{" "}
        <button className="text-button" onClick={onSettings}>
          Open reset settings
        </button>
      </p>
    )}
    <button className="primary" disabled={!!error || busy} onClick={onStart}>
      Start Practice Test
    </button>
  </section>
);
