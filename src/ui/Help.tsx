import { useRef } from "react";

export function ShortcutHelp() {
  return (
    <div className="shortcut-help">
      <dl>
        <dt>← / →</dt>
        <dd>Previous / next question</dd>
        <dt>1–4</dt>
        <dd>Choose answer A–D (A, C, and D also work while reading)</dd>
        <dt>Enter / Space</dt>
        <dd>
          Check your answer; after feedback, advance or review the session
        </dd>
        <dt>B</dt>
        <dd>Toggle the current question’s bookmark</dd>
        <dt>Escape</dt>
        <dd>Close a panel or dialog</dd>
      </dl>
      <p className="small muted">
        Shortcuts apply while reading. Focused controls keep their normal keys;
        Enter also submits a selected answer choice or numeric answer. Use Tab
        to reach controls and Space to activate them.
      </p>
      <p className="small muted">
        Exit saves your place. Resume any unfinished set from Practice. Find
        saved questions in Review → Bookmarks. The question number opens the
        session map. Practice tools contain timing and question details.
      </p>
    </div>
  );
}

export function Help() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        className="text-button help-link"
        aria-label="Help and keyboard shortcuts"
        onClick={() => dialog.current?.showModal()}
      >
        Help
      </button>
      <dialog
        ref={dialog}
        className="practice-dialog"
        aria-labelledby="help-title"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-heading">
          <h2 id="help-title">Using SAT Study</h2>
          <button
            aria-label="Close help"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="help-content">
          <section>
            <h3>Practice and Browse</h3>
            <p>
              <strong>Practice</strong> creates and resumes study sessions.
              <strong> Browse</strong> lets you search the library and inspect
              individual questions without starting a session.
            </p>
          </section>
          <details>
            <summary>Practice-test question protection</summary>
            <p>
              Some imported questions may belong to active practice tests.
              Protection hides those questions during ordinary study so you do
              not accidentally spoil a future test. Inactive questions remain
              available. Questions with unknown status also remain available
              because the portal cannot confidently identify them as active.
            </p>
            <p>
              Turning protection off makes active questions eligible again. The
              portal asks for confirmation before opening or starting a set that
              contains one.
            </p>
          </details>
          <details>
            <summary>Answer status</summary>
            <dl className="help-definitions">
              <dt>All</dt>
              <dd>No answer-status restriction.</dd>
              <dt>Unanswered</dt>
              <dd>
                In Practice filters, questions with no recorded answer. In
                Review, only questions previously assigned to a session and
                still without a recorded answer.
              </dd>
              <dt>Mistakes</dt>
              <dd>Questions whose latest recorded answer is incorrect.</dd>
              <dt>Completed</dt>
              <dd>Questions with a recorded submitted answer.</dd>
            </dl>
          </details>
          <details>
            <summary>Sessions and saved questions</summary>
            <p>
              New sessions are shuffled; resuming preserves the saved order and
              your place. Bookmarks are available from Review and do not count
              as answers.
            </p>
          </details>
          <details>
            <summary>Keyboard shortcuts</summary>
            <ShortcutHelp />
          </details>
        </div>
      </dialog>
    </>
  );
}
