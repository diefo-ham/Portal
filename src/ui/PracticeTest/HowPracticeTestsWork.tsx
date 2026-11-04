/** The collapsed explanation under the Practice Test setup form. */
export const HowPracticeTestsWork = () => (
  <details className="utility">
    <summary>How Practice Tests work</summary>
    <p>
      A Full Test moves through Reading and Writing Modules 1 and 2, an optional
      break, then Math Modules 1 and 2. You can move freely inside a module.
      Finishing it locks its answers.
    </p>
    <p>
      Module 2 adapts to scored Module 1 performance using a transparent
      approximation. Individual modules use the difficulty route you select.
    </p>
    <p>
      Exactly two randomly chosen questions per module are simulated as
      unscored. Their identities stay hidden during the test. Results show
      scored accuracy and an unofficial estimated SAT range, using available
      difficulty and route metadata.
    </p>
    <p>
      Questions included in a module stay used for Practice Tests, even if you
      leave or delete the attempt. Overall study-progress reset in Settings
      restores eligibility.
    </p>
  </details>
);
